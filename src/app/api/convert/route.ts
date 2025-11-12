import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase'

// Ensure this route runs in the Node.js runtime so native modules (e.g. sharp) work on Vercel
export const runtime = 'nodejs'

// DXF conversions can take a bit of time for large images
export const maxDuration = 60

interface ConversionOptions {
  threshold?: number
  simplify?: number
  storeInSupabase?: boolean
  width?: number
  height?: number
  dimensionControl?: 'width' | 'height'
}

// Ultra-simple DXF writer for maximum compatibility
class SimpleDxfWriter {
  private content: string[] = []
  
  constructor() {
    // Minimal DXF header
    this.content.push('0')
    this.content.push('SECTION')
    this.content.push('2')
    this.content.push('HEADER')
    this.content.push('0')
    this.content.push('ENDSEC')
    
    // Entities section
    this.content.push('0')
    this.content.push('SECTION')
    this.content.push('2')
    this.content.push('ENTITIES')
  }
  
  addPolyline(points: number[][], options: { layer: string; closed: boolean } = { layer: '0', closed: false }) {
    if (points.length < 2) return
    
    console.log(`Creating DXF with ${points.length} points`)
    
    // Clean up points to remove duplicates and very close points
    const cleanedPoints = this.cleanPoints(points)
    console.log(`Cleaned to ${cleanedPoints.length} points`)
    
    // Create individual LINE entities for maximum compatibility
    for (let i = 0; i < cleanedPoints.length; i++) {
      const current = cleanedPoints[i]
      const next = cleanedPoints[(i + 1) % cleanedPoints.length]
      
      // Skip if current and next points are identical
      const dx = next[0] - current[0]
      const dy = next[1] - current[1]
      const distance = Math.sqrt(dx * dx + dy * dy)
      
      if (distance < 0.001) {
        console.log(`Skipping duplicate line segment at index ${i}`)
        continue
      }
      
      this.content.push('0')
      this.content.push('LINE')
      this.content.push('8')
      this.content.push(options.layer)
      this.content.push('10')
      this.content.push(current[0].toString())
      this.content.push('20')
      this.content.push(current[1].toString())
      this.content.push('30')
      this.content.push('0.0')
      this.content.push('11')
      this.content.push(next[0].toString())
      this.content.push('21')
      this.content.push(next[1].toString())
      this.content.push('31')
      this.content.push('0.0')
    }
  }
  
  // Clean up points to remove duplicates and very close points
  private cleanPoints(points: number[][]): number[][] {
    if (points.length < 2) return points
    
    const cleaned: number[][] = [points[0]]
    const minDistance = 0.01 // Slightly larger minimum distance to prevent double lines
    
    for (let i = 1; i < points.length; i++) {
      const current = points[i]
      const last = cleaned[cleaned.length - 1]
      
      const dx = current[0] - last[0]
      const dy = current[1] - last[1]
      const distance = Math.sqrt(dx * dx + dy * dy)
      
      if (distance >= minDistance) {
        cleaned.push(current)
      }
    }
    
    // Ensure the path is properly closed
    if (cleaned.length > 2) {
      const first = cleaned[0]
      const last = cleaned[cleaned.length - 1]
      const dx = last[0] - first[0]
      const dy = last[1] - first[1]
      const distance = Math.sqrt(dx * dx + dy * dy)
      
      if (distance >= minDistance) {
        cleaned.push([first[0], first[1]])
      }
    }
    
    return cleaned
  }
  
  
  toString(): string {
    this.content.push('0')
    this.content.push('ENDSEC')
    this.content.push('0')
    this.content.push('EOF')
    return this.content.join('\n')
  }
}

// Perfect single-line contour tracing using OpenCV-style algorithm
function findContours(imageData: Buffer, width: number, height: number, threshold: number): number[][][] {
  // Convert to binary image (data is already thresholded by Sharp)
  const pixels: number[][] = []
  for (let y = 0; y < height; y++) {
    pixels[y] = []
    for (let x = 0; x < width; x++) {
      const idx = y * width + x
      const gray = imageData[idx]
      pixels[y][x] = gray < threshold ? 1 : 0 // Sharp threshold produces 0 or 255
    }
  }
  
  console.log(`Starting single-line contour detection on ${width}x${height} image`)
  
  // Find only the outer boundary to avoid double lines
  const outerBoundary = findSingleOuterBoundary(pixels, width, height)
  
  if (outerBoundary.length > 2) {
    console.log(`Found outer boundary with ${outerBoundary.length} points`)
    return [outerBoundary]
  }
  
  console.log(`No valid boundary found`)
  return []
}

// Find single outer boundary by tracing the actual edge of the shape
function findSingleOuterBoundary(pixels: number[][], width: number, height: number): number[][] {
  // Find the first black pixel to start tracing
  let startX = -1, startY = -1
  for (let y = 0; y < height && startX === -1; y++) {
    for (let x = 0; x < width && startX === -1; x++) {
      if (pixels[y][x] === 1) {
        startX = x
        startY = y
      }
    }
  }
  
  if (startX === -1) return []
  
  console.log(`Starting boundary trace from (${startX}, ${startY})`)
  
  // Use a simple boundary tracing that follows the outer edge
  const boundary: number[][] = []
  const visited = new Set<string>()
  
  // Start from the top-left corner of the shape and trace clockwise
  let currentX = startX
  let currentY = startY
  let direction = 0 // Start looking East
  
  // 8-directional movement
  const directions = [
    [1, 0],   // East
    [1, -1],  // Northeast  
    [0, -1],  // North
    [-1, -1], // Northwest
    [-1, 0],  // West
    [-1, 1],  // Southwest
    [0, 1],   // South
    [1, 1]    // Southeast
  ]
  
  boundary.push([currentX, -currentY]) // Invert Y for DXF
  visited.add(`${currentX},${currentY}`)
  
  let iterations = 0
  const maxIterations = width * height * 2
  
  while (iterations < maxIterations) {
    let found = false
    let nextX = -1, nextY = -1, nextDirection = -1
    
    // Look for the next boundary pixel
    for (let i = 0; i < 8; i++) {
      const dirIndex = (direction + i) % 8
      const [dx, dy] = directions[dirIndex]
      const testX = currentX + dx
      const testY = currentY + dy
      
      if (testX >= 0 && testX < width && testY >= 0 && testY < height) {
        if (pixels[testY][testX] === 1 && !visited.has(`${testX},${testY}`)) {
          // Check if this pixel is on the boundary (has at least one white neighbor)
          let hasWhiteNeighbor = false
          for (let checkY = testY - 1; checkY <= testY + 1; checkY++) {
            for (let checkX = testX - 1; checkX <= testX + 1; checkX++) {
              if (checkX >= 0 && checkX < width && checkY >= 0 && checkY < height) {
                if (pixels[checkY][checkX] === 0) {
                  hasWhiteNeighbor = true
                  break
                }
              } else {
                // Edge of image counts as white
                hasWhiteNeighbor = true
                break
              }
            }
            if (hasWhiteNeighbor) break
          }
          
          if (hasWhiteNeighbor) {
            nextX = testX
            nextY = testY
            nextDirection = (dirIndex + 6) % 8 // Turn left 90 degrees
            found = true
            break
          }
        }
      }
    }
    
    if (!found) break
    
    // Check if we've completed the loop
    if (nextX === startX && nextY === startY && boundary.length > 3) {
      console.log(`Completed boundary loop with ${boundary.length} points`)
      break
    }
    
    // Add the next point
    boundary.push([nextX, -nextY])
    visited.add(`${nextX},${nextY}`)
    
    currentX = nextX
    currentY = nextY
    direction = nextDirection
    iterations++
  }
  
  console.log(`Boundary tracing completed with ${boundary.length} points after ${iterations} iterations`)
  return boundary
}




// Clean up the path for crisp, accurate lines
function cleanPath(path: number[][]): number[][] {
  if (path.length < 3) return path
  
  const cleaned: number[][] = []
  const tolerance = 0.5 // Minimum distance between points
  
  // Always keep the first point
  cleaned.push(path[0])
  
  for (let i = 1; i < path.length; i++) {
    const current = path[i]
    const last = cleaned[cleaned.length - 1]
    
    // Calculate distance from last kept point
    const distance = Math.sqrt(
      Math.pow(current[0] - last[0], 2) + 
      Math.pow(current[1] - last[1], 2)
    )
    
    // Keep point if it's far enough from the last kept point
    if (distance > tolerance) {
      cleaned.push(current)
    }
  }
  
  // Ensure the path is closed properly
  if (cleaned.length > 2) {
    const first = cleaned[0]
    const last = cleaned[cleaned.length - 1]
    const distance = Math.sqrt(
      Math.pow(first[0] - last[0], 2) + 
      Math.pow(first[1] - last[1], 2)
    )
    
    // If not closed, add the first point at the end
    if (distance > tolerance) {
      cleaned.push([first[0], first[1]])
    }
  }
  
  return cleaned
}

// Smooth contour to remove wavy lines while preserving shape
function smoothContour(contour: number[][]): number[][] {
  if (contour.length < 3) return contour
  
  // Apply multiple passes of smoothing for better results
  let smoothed = [...contour]
  
  // First pass: 3-point moving average
  smoothed = applyMovingAverage(smoothed, 3)
  
  // Second pass: 5-point moving average for stronger smoothing
  smoothed = applyMovingAverage(smoothed, 5)
  
  // Third pass: Gaussian-like smoothing
  smoothed = applyGaussianSmoothing(smoothed)
  
  return smoothed
}

// Scale contour to desired dimension (in inches)
function scaleContour(contour: number[][], targetDimensionInches: number, imageDimensionPixels: number, dimensionControl: 'width' | 'height'): number[][] {
  if (contour.length === 0) return contour
  
  // Always scale based on the full image dimension, not the contour dimension
  // This ensures consistent scaling regardless of contour detection quality
  const currentDimensionPixels = imageDimensionPixels
  
  // DXF files typically use inches as the base unit, not millimeters
  // So we'll work directly in inches
  
  // Calculate scale factor: target dimension in inches / image dimension in pixels
  // This gives us inches per pixel
  const scaleFactor = targetDimensionInches / currentDimensionPixels
  
  // Debug logging
  console.log(`Scaling debug:`)
  console.log(`  Target ${dimensionControl}: ${targetDimensionInches} inches`)
  console.log(`  Image ${dimensionControl}: ${imageDimensionPixels} pixels`)
  console.log(`  Scale factor: ${scaleFactor} inches/pixel`)
  console.log(`  Contour points count: ${contour.length}`)
  console.log(`  Sample contour points (first 3):`, contour.slice(0, 3))
  
  // Scale all points from pixels to inches
  const scaledContour = contour.map(([x, y]) => [
    x * scaleFactor,
    y * scaleFactor
  ])
  
  console.log(`  Sample scaled points (first 3):`, scaledContour.slice(0, 3))
  
  // Calculate final dimensions for verification
  let finalMinX = Infinity, finalMaxX = -Infinity, finalMinY = Infinity, finalMaxY = -Infinity
  for (const [x, y] of scaledContour) {
    finalMinX = Math.min(finalMinX, x)
    finalMaxX = Math.max(finalMaxX, x)
    finalMinY = Math.min(finalMinY, y)
    finalMaxY = Math.max(finalMaxY, y)
  }
  const finalWidthInches = finalMaxX - finalMinX
  const finalHeightInches = finalMaxY - finalMinY
  console.log(`  Final width: ${finalWidthInches} inches`)
  console.log(`  Final height: ${finalHeightInches} inches`)
  
  return scaledContour
}

// Straighten lines that are very close to 0° or 90° (within 0.03 radians)
function straightenNearOrthogonalLines(contour: number[][]): number[][] {
  if (contour.length < 2) return contour
  
  const straightened: number[][] = []
  const tolerance = 0.03 // 0.03 radians ≈ 1.72 degrees
  let straightenedCount = 0
  
  // Start with the first point
  straightened.push(contour[0])
  
  for (let i = 0; i < contour.length; i++) {
    const current = contour[i]
    const next = contour[(i + 1) % contour.length]
    
    // Calculate the angle of the line segment
    const dx = next[0] - current[0]
    const dy = next[1] - current[1]
    const angle = Math.atan2(dy, dx)
    
    // Normalize angle to 0 to 2π range
    let normalizedAngle = angle
    while (normalizedAngle < 0) normalizedAngle += 2 * Math.PI
    while (normalizedAngle >= 2 * Math.PI) normalizedAngle -= 2 * Math.PI
    
    // Check if the angle is close to 0° (horizontal) or 90° (vertical)
    const isNearHorizontal = Math.abs(normalizedAngle) < tolerance || 
                            Math.abs(normalizedAngle - Math.PI) < tolerance || 
                            Math.abs(normalizedAngle - 2 * Math.PI) < tolerance
    const isNearVertical = Math.abs(normalizedAngle - Math.PI/2) < tolerance || 
                          Math.abs(normalizedAngle - 3 * Math.PI/2) < tolerance
    
    if (isNearHorizontal) {
      // Make it perfectly horizontal (dy = 0)
      const straightenedNext = [next[0], current[1]]
      straightened.push(straightenedNext)
      straightenedCount++
    } else if (isNearVertical) {
      // Make it perfectly vertical (dx = 0)
      const straightenedNext = [current[0], next[1]]
      straightened.push(straightenedNext)
      straightenedCount++
    } else {
      // Keep the original point
      straightened.push(next)
    }
  }
  
  console.log(`Line straightening: ${straightenedCount} out of ${contour.length} line segments were straightened`)
  
  return straightened
}

// Remove duplicate points that are very close to each other
function removeDuplicatePoints(contour: number[][], tolerance: number = 0.001): number[][] {
  if (contour.length < 2) return contour
  
  const cleaned: number[][] = [contour[0]]
  
  for (let i = 1; i < contour.length; i++) {
    const current = contour[i]
    const last = cleaned[cleaned.length - 1]
    
    const dx = current[0] - last[0]
    const dy = current[1] - last[1]
    const distance = Math.sqrt(dx * dx + dy * dy)
    
    // Only add the point if it's far enough from the last point
    if (distance > tolerance) {
      cleaned.push(current)
    }
  }
  
  // Also check if the last point is too close to the first point (for closed contours)
  if (cleaned.length > 2) {
    const first = cleaned[0]
    const last = cleaned[cleaned.length - 1]
    const dx = last[0] - first[0]
    const dy = last[1] - first[1]
    const distance = Math.sqrt(dx * dx + dy * dy)
    
    if (distance < tolerance) {
      cleaned.pop() // Remove the last point if it's too close to the first
    }
  }
  
  console.log(`Duplicate removal: ${contour.length} points → ${cleaned.length} points`)
  
  return cleaned
}

// Apply moving average smoothing
function applyMovingAverage(contour: number[][], windowSize: number): number[][] {
  if (contour.length < windowSize) return contour
  
  const smoothed: number[][] = []
  
  for (let i = 0; i < contour.length; i++) {
    let sumX = 0
    let sumY = 0
    let count = 0
    
    // Calculate moving average
    for (let j = -Math.floor(windowSize / 2); j <= Math.floor(windowSize / 2); j++) {
      const index = (i + j + contour.length) % contour.length
      sumX += contour[index][0]
      sumY += contour[index][1]
      count++
    }
    
    smoothed.push([
      sumX / count,
      sumY / count
    ])
  }
  
  return smoothed
}

// Apply Gaussian-like smoothing
function applyGaussianSmoothing(contour: number[][]): number[][] {
  if (contour.length < 5) return contour
  
  const smoothed: number[][] = []
  const weights = [0.1, 0.2, 0.4, 0.2, 0.1] // Gaussian-like weights
  
  for (let i = 0; i < contour.length; i++) {
    let sumX = 0
    let sumY = 0
    let totalWeight = 0
    
    // Apply weighted average
    for (let j = -2; j <= 2; j++) {
      const index = (i + j + contour.length) % contour.length
      const weight = weights[j + 2]
      sumX += contour[index][0] * weight
      sumY += contour[index][1] * weight
      totalWeight += weight
    }
    
    smoothed.push([
      sumX / totalWeight,
      sumY / totalWeight
    ])
  }
  
  return smoothed
}

async function convertRasterToDxf(imageBuffer: Buffer, options: ConversionOptions = {}): Promise<string> {
  const { threshold = 128, simplify = 0.1, width = 2.25, height = 0.75, dimensionControl = 'width' } = options
  
  try {
    // 1. Process image with Sharp for maximum detail preservation
    const { data: imageData, info } = await sharp(imageBuffer)
      .resize(2000, 2000, { 
        fit: 'inside',
        withoutEnlargement: true 
      })
      .greyscale()
      .normalize()
      .sharpen({ sigma: 2.0, m1: 0.5, m2: 5.0, x1: 2, y2: 10 }) // Very strong sharpening for crisp edges
      .threshold(threshold) // Apply threshold in Sharp for better binary conversion
      .raw()
      .toBuffer({ resolveWithObject: true })

    const imageWidth = info.width
    const imageHeight = info.height
    
    console.log(`Image processing debug:`)
    console.log(`  Original image: ${imageWidth}x${imageHeight} pixels`)
    console.log(`  Dimension control: ${dimensionControl}`)
    console.log(`  Target ${dimensionControl}: ${dimensionControl === 'width' ? width : height} inches`)
    console.log(`  Scale factor will be: ${dimensionControl === 'width' ? width : height} / ${dimensionControl === 'width' ? imageWidth : imageHeight} = ${dimensionControl === 'width' ? width / imageWidth : height / imageHeight}`)
    
    // 2. Find contours using our improved edge-following algorithm
    const contours = findContours(imageData, imageWidth, imageHeight, threshold)
    
    console.log(`Found ${contours.length} contours`)
    
    // 3. Create DXF with contours as polylines
    const writer = new SimpleDxfWriter()
    
    // Create a single clean line from the boundary
    if (contours.length > 0 && contours[0].length > 2) {
      console.log(`Using first contour with ${contours[0].length} points`)
      
      // If there are multiple contours, warn about it
      if (contours.length > 1) {
        console.log(`WARNING: Found ${contours.length} contours, using only the first one. This might cause incomplete DXF output.`)
      }
      
      const boundary = contours[0]
      
      // Clean up the path for crisp lines
      const initialCleanedPath = cleanPath(boundary)
      
      // Apply smoothing to remove wavy lines
      const smoothedPath = smoothContour(initialCleanedPath)
      
      // Apply minimal simplification to preserve detail
      const simplifiedPath = simplify ? simplifyContour(smoothedPath, simplify * 0.3) : smoothedPath
      
      // Straighten lines that are very close to 0° or 90°
      const straightenedPath = straightenNearOrthogonalLines(simplifiedPath)
      
      // Remove duplicate points that might cause overlapping lines
      const deduplicatedPath = removeDuplicatePoints(straightenedPath)
      
      // Scale the path to the desired dimension
      const scaledPath = scaleContour(deduplicatedPath, dimensionControl === 'width' ? width : height, dimensionControl === 'width' ? imageWidth : imageHeight, dimensionControl)
      
      // Create as a single polyline
      writer.addPolyline(scaledPath, {
        layer: '0',
        closed: true
      })
    }

    return writer.toString()
  } catch (error) {
    console.error('Conversion error:', error)
    throw new Error(`Conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// Smart simplification that preserves both straight lines and curves
function simplifyContour(contour: number[][], tolerance: number): number[][] {
  if (contour.length <= 2) return contour
  
  // Use adaptive tolerance - smaller for curves, larger for straight sections
  const scaledTolerance = Math.max(tolerance * 0.3, 0.05) // Even smaller tolerance for precision
  
  function getPerpendicularDistance(point: number[], lineStart: number[], lineEnd: number[]): number {
    const A = point[0] - lineStart[0]
    const B = point[1] - lineStart[1]
    const C = lineEnd[0] - lineStart[0]
    const D = lineEnd[1] - lineStart[1]
    
    const dot = A * C + B * D
    const lenSq = C * C + D * D
    
    if (lenSq === 0) return Math.sqrt(A * A + B * B)
    
    const param = dot / lenSq
    
    let xx, yy
    if (param < 0) {
      xx = lineStart[0]
      yy = lineStart[1]
    } else if (param > 1) {
      xx = lineEnd[0]
      yy = lineEnd[1]
    } else {
      xx = lineStart[0] + param * C
      yy = lineStart[1] + param * D
    }
    
    const dx = point[0] - xx
    const dy = point[1] - yy
    return dx * dx + dy * dy
  }
  
  function douglasPeucker(points: number[][], tolerance: number): number[][] {
    if (points.length <= 2) return points
    
    let maxDistance = 0
    let maxIndex = 0
    
    for (let i = 1; i < points.length - 1; i++) {
      const distance = getPerpendicularDistance(points[i], points[0], points[points.length - 1])
      if (distance > maxDistance) {
        maxDistance = distance
        maxIndex = i
      }
    }
    
    if (maxDistance > tolerance) {
      const left = douglasPeucker(points.slice(0, maxIndex + 1), tolerance)
      const right = douglasPeucker(points.slice(maxIndex), tolerance)
      return [...left.slice(0, -1), ...right]
    } else {
      return [points[0], points[points.length - 1]]
    }
  }
  
  return douglasPeucker(contour, scaledTolerance)
}

async function storeInSupabaseStorage(originalImage: Buffer, dxfContent: string, filename: string) {
  if (!isSupabaseConfigured() || !supabaseAdmin) {
    throw new Error('Supabase is not configured')
  }

  try {
    const timestamp = Date.now()
    const baseFilename = filename.replace(/\.[^/.]+$/, '')
    
    // Store original image
    const imagePath = `images/${timestamp}-${baseFilename}.png`
    const { error: imageError } = await supabaseAdmin.storage
      .from('snap2dxf-outputs')
      .upload(imagePath, originalImage, {
        contentType: 'image/png',
        upsert: false
      })

    if (imageError) throw imageError

    // Store DXF file
    const dxfPath = `public/${timestamp}-${baseFilename}.dxf`
    const { error: dxfError } = await supabaseAdmin.storage
      .from('snap2dxf-outputs')
      .upload(dxfPath, dxfContent, {
        contentType: 'application/dxf',
        upsert: false
      })

    if (dxfError) throw dxfError

    // Get public URLs
    const { data: imageData } = supabaseAdmin.storage
      .from('snap2dxf-outputs')
      .getPublicUrl(imagePath)

    const { data: dxfData } = supabaseAdmin.storage
      .from('snap2dxf-outputs')
      .getPublicUrl(dxfPath)

    return {
      imageUrl: imageData.publicUrl,
      dxfUrl: dxfData.publicUrl
    }
  } catch (error) {
    console.error('Supabase storage error:', error)
    throw new Error('Failed to store files in Supabase')
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const threshold = parseInt(formData.get('threshold') as string) || 128
    const simplify = parseFloat(formData.get('simplify') as string) || 0.1
    const storeInSupabase = formData.get('storeInSupabase') === 'true'
    const width = parseFloat(formData.get('width') as string) || 2.25
    const height = parseFloat(formData.get('height') as string) || 0.75
    const dimensionControl = (formData.get('dimensionControl') as 'width' | 'height') || 'width'

    // Validate file
    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      )
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { success: false, error: 'File must be an image' },
        { status: 400 }
      )
    }

    // Validate file size (10MB max)
    const maxSize = parseInt(process.env.MAX_FILE_SIZE || '10485760')
    if (file.size > maxSize) {
      return NextResponse.json(
        { success: false, error: 'File too large. Maximum size is 10MB.' },
        { status: 400 }
      )
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer()
    const imageBuffer = Buffer.from(arrayBuffer)

    // Convert image to DXF
    const dxfContent = await convertRasterToDxf(imageBuffer, {
      threshold,
      simplify,
      storeInSupabase,
      width,
      height,
      dimensionControl
    })

    // Store in Supabase if requested and configured
    let storageUrls = null
    if (storeInSupabase && isSupabaseConfigured()) {
      try {
        storageUrls = await storeInSupabaseStorage(imageBuffer, dxfContent, file.name)
      } catch (error) {
        console.warn('Supabase storage failed, continuing without storage:', error)
      }
    } else if (storeInSupabase && !isSupabaseConfigured()) {
      console.warn('Supabase storage requested but not configured, continuing without storage')
    }

    // Return DXF file as download
    const filename = file.name.replace(/\.[^/.]+$/, '') + '.dxf'
    
    return new NextResponse(dxfContent, {
      status: 200,
      headers: {
        'Content-Type': 'application/dxf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache',
        ...(storageUrls && {
          'X-Image-URL': storageUrls.imageUrl,
          'X-DXF-URL': storageUrls.dxfUrl
        })
      }
    })

  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Conversion failed' 
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString()
  })
}
