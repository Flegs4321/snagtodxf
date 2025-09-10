import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase'

// Configure API route
export const config = {
  api: {
    bodyParser: false,
  },
}

interface ConversionOptions {
  threshold?: number
  simplify?: number
  storeInSupabase?: boolean
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
    
    // Create individual LINE entities for maximum compatibility
    for (let i = 0; i < points.length; i++) {
      const current = points[i]
      const next = points[(i + 1) % points.length]
      
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
      pixels[y][x] = gray < 128 ? 1 : 0 // Sharp threshold produces 0 or 255
    }
  }
  
  // Find the perfect contour using chain code algorithm
  const contour = findPerfectContour(pixels, width, height)
  
  return contour.length > 0 ? [contour] : []
}

// Find perfect contour using proper boundary detection
function findPerfectContour(pixels: number[][], width: number, height: number): number[][] {
  // First, find all boundary pixels
  const boundaryPixels = findBoundaryPixels(pixels, width, height)
  
  if (boundaryPixels.length === 0) return []
  
  // Find the starting point (topmost, leftmost boundary pixel)
  let startIdx = 0
  for (let i = 1; i < boundaryPixels.length; i++) {
    const [x, y] = boundaryPixels[i]
    const [startX, startY] = boundaryPixels[startIdx]
    if (y < startY || (y === startY && x < startX)) {
      startIdx = i
    }
  }
  
  const [startX, startY] = boundaryPixels[startIdx]
  const contour: number[][] = []
  const visited = new Set<string>()
  
  // Chain code directions (8-connected)
  const directions = [
    [1, 0],   // 0: East
    [1, -1],  // 1: Northeast
    [0, -1],  // 2: North
    [-1, -1], // 3: Northwest
    [-1, 0],  // 4: West
    [-1, 1],  // 5: Southwest
    [0, 1],   // 6: South
    [1, 1]    // 7: Southeast
  ]
  
  let currentX = startX
  let currentY = startY
  let direction = 0 // Start looking East
  
  contour.push([currentX, -currentY])
  visited.add(`${currentX},${currentY}`)
  
  let iterations = 0
  const maxIterations = boundaryPixels.length * 2
  
  while (iterations < maxIterations) {
    let found = false
    let nextX = -1, nextY = -1, nextDirection = -1
    
    // Look for the next boundary pixel using chain code
    for (let i = 0; i < 8; i++) {
      const dirIndex = (direction + i) % 8
      const [dx, dy] = directions[dirIndex]
      const testX = currentX + dx
      const testY = currentY + dy
      
      if (testX >= 0 && testX < width && testY >= 0 && testY < height) {
        if (pixels[testY][testX] === 1 && !visited.has(`${testX},${testY}`)) {
          nextX = testX
          nextY = testY
          nextDirection = (dirIndex + 6) % 8 // Turn left 90 degrees
          found = true
          break
        }
      }
    }
    
    if (!found) break
    
    // Check if we've completed the loop
    if (nextX === startX && nextY === startY && contour.length > 3) {
      break
    }
    
    // Add the next point
    contour.push([nextX, -nextY])
    visited.add(`${nextX},${nextY}`)
    
    currentX = nextX
    currentY = nextY
    direction = nextDirection
    iterations++
  }
  
  return contour
}

// Find all boundary pixels (pixels that are black and have at least one white neighbor)
function findBoundaryPixels(pixels: number[][], width: number, height: number): number[][] {
  const boundaryPixels: number[][] = []
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (pixels[y][x] === 1) { // Black pixel
        // Check if it has at least one white neighbor
        let hasWhiteNeighbor = false
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue
            const nx = x + dx
            const ny = y + dy
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              if (pixels[ny][nx] === 0) { // White pixel
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
          boundaryPixels.push([x, y])
        }
      }
    }
  }
  
  return boundaryPixels
}

// Apply Sobel edge detection
function applySobelEdgeDetection(pixels: number[][], edges: number[][], width: number, height: number) {
  // Sobel kernels
  const sobelX = [[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]]
  const sobelY = [[-1, -2, -1], [0, 0, 0], [1, 2, 1]]
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let gx = 0, gy = 0
      
      // Apply Sobel kernels
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const pixel = pixels[y + ky][x + kx]
          gx += pixel * sobelX[ky + 1][kx + 1]
          gy += pixel * sobelY[ky + 1][kx + 1]
        }
      }
      
      const magnitude = Math.sqrt(gx * gx + gy * gy)
      edges[y][x] = magnitude
    }
  }
}

// Trace boundary using edge information
function traceEdgeBoundary(edges: number[][], width: number, height: number, threshold: number): number[][] {
  // Find the strongest edge to start
  let maxEdge = 0
  let startX = -1, startY = -1
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      if (edges[y][x] > maxEdge) {
        maxEdge = edges[y][x]
        startX = x
        startY = y
      }
    }
  }
  
  if (startX === -1 || maxEdge < threshold) return []
  
  const boundary: number[][] = []
  const visited = new Set<string>()
  
  // Use 8-connected neighborhood for boundary following
  const directions = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1],           [0, 1],
    [1, -1],  [1, 0],  [1, 1]
  ]
  
  let currentX = startX
  let currentY = startY
  let direction = 0
  
  boundary.push([currentX, -currentY])
  visited.add(`${currentX},${currentY}`)
  
  let iterations = 0
  const maxIterations = width * height * 2
  
  while (iterations < maxIterations) {
    let found = false
    let nextX = -1, nextY = -1, nextDirection = -1
    let bestEdge = 0
    
    // Look for the next edge pixel in all 8 directions
    for (let i = 0; i < 8; i++) {
      const dirIndex = (direction + i) % 8
      const [dx, dy] = directions[dirIndex]
      const testX = currentX + dx
      const testY = currentY + dy
      
      if (testX >= 0 && testX < width && testY >= 0 && testY < height) {
        const edgeStrength = edges[testY][testX]
        if (edgeStrength > threshold && edgeStrength > bestEdge) {
          nextX = testX
          nextY = testY
          nextDirection = (dirIndex + 6) % 8
          bestEdge = edgeStrength
          found = true
        }
      }
    }
    
    if (!found) break
    
    // Check if we've completed the loop
    if (nextX === startX && nextY === startY && boundary.length > 3) {
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
  
  return boundary
}

// Trace a single clean boundary line using improved algorithm
function traceSingleBoundary(pixels: number[][], width: number, height: number): number[][] {
  // Find the first black pixel to start
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
  
  const boundary: number[][] = []
  const visited = new Set<string>()
  
  // Use 8-connected neighborhood for boundary following
  const directions = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1],           [0, 1],
    [1, -1],  [1, 0],  [1, 1]
  ]
  
  let currentX = startX
  let currentY = startY
  let direction = 0 // Start looking in the first direction
  
  boundary.push([currentX, -currentY])
  visited.add(`${currentX},${currentY}`)
  
  let iterations = 0
  const maxIterations = width * height * 2
  
  while (iterations < maxIterations) {
    let found = false
    let nextX = -1, nextY = -1, nextDirection = -1
    
    // Look for the next boundary pixel in all 8 directions
    for (let i = 0; i < 8; i++) {
      const dirIndex = (direction + i) % 8
      const [dx, dy] = directions[dirIndex]
      const testX = currentX + dx
      const testY = currentY + dy
      
      if (testX >= 0 && testX < width && testY >= 0 && testY < height) {
        if (pixels[testY][testX] === 1) {
          nextX = testX
          nextY = testY
          nextDirection = (dirIndex + 6) % 8 // Turn left 90 degrees
          found = true
          break
        }
      }
    }
    
    if (!found) break
    
    // Check if we've completed the loop
    if (nextX === startX && nextY === startY && boundary.length > 3) {
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
  
  return boundary
}




// Combine multiple contours into a single continuous path
function combineContoursIntoPath(contours: number[][][]): number[][] {
  if (contours.length === 0) return []
  if (contours.length === 1) return contours[0]
  
  const singlePath: number[][] = []
  const usedContours = new Set<number>()
  
  // Start with the largest contour
  singlePath.push(...contours[0])
  usedContours.add(0)
  
  // Connect remaining contours by finding the closest points
  while (usedContours.size < contours.length) {
    let bestContour = -1
    let bestIndex = 0
    let minDistance = Infinity
    let bestConnectionPoint = 0
    
    // Find the closest unused contour to any point in our current path
    for (let i = 0; i < contours.length; i++) {
      if (usedContours.has(i)) continue
      
      const currentContour = contours[i]
      if (currentContour.length === 0) continue
      
      // Check distance from every point in current path to every point in this contour
      for (let pathIdx = 0; pathIdx < singlePath.length; pathIdx++) {
        const pathPoint = singlePath[pathIdx]
        
        for (let j = 0; j < currentContour.length; j++) {
          const distance = Math.sqrt(
            Math.pow(pathPoint[0] - currentContour[j][0], 2) + 
            Math.pow(pathPoint[1] - currentContour[j][1], 2)
          )
          
          if (distance < minDistance) {
            minDistance = distance
            bestContour = i
            bestIndex = j
            bestConnectionPoint = pathIdx
          }
        }
      }
    }
    
    if (bestContour === -1) break // No more contours to connect
    
    const currentContour = contours[bestContour]
    
    // Add a connecting line if the distance is reasonable
    if (minDistance < 100) { // Increased threshold for better connections
      const pathPoint = singlePath[bestConnectionPoint]
      const contourPoint = currentContour[bestIndex]
      
      // Add connecting line
      singlePath.splice(bestConnectionPoint + 1, 0, 
        [pathPoint[0], pathPoint[1]], // Duplicate connection point
        [contourPoint[0], contourPoint[1]] // Connect to contour
      )
    }
    
    // Add the contour starting from the closest point
    for (let j = 0; j < currentContour.length; j++) {
      const index = (bestIndex + j) % currentContour.length
      singlePath.push(currentContour[index])
    }
    
    usedContours.add(bestContour)
  }
  
  return singlePath
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

// Apply morphological operations to clean up the binary image
function applyMorphology(pixels: number[][], width: number, height: number): number[][] {
  const result: number[][] = []
  
  // Initialize result array
  for (let y = 0; y < height; y++) {
    result[y] = new Array(width).fill(0)
  }
  
  // Erosion followed by dilation (opening) to remove noise
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      // Check 3x3 neighborhood
      let count = 0
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (pixels[y + dy][x + dx] === 1) count++
        }
      }
      // Keep pixel if it has enough neighbors (erosion)
      result[y][x] = count >= 5 ? 1 : 0
    }
  }
  
  return result
}

// Ultra-detailed contour tracing for maximum complexity
function traceDetailedContour(pixels: number[][], startX: number, startY: number, width: number, height: number, visited: Set<string>, minLevel: number, prefix: string): number[][] {
  const contour: number[][] = []
  const stack: number[][] = [[startX, startY]]
  
  // 8-directional search with priority for edge following
  const directions = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1],           [0, 1],
    [1, -1],  [1, 0],  [1, 1]
  ]
  
  while (stack.length > 0) {
    const [x, y] = stack.pop()!
    const key = `${prefix}${x},${y}`
    
    if (visited.has(key) || x < 0 || x >= width || y < 0 || y >= height || pixels[y][x] < minLevel) {
      continue
    }
    
    visited.add(key)
    contour.push([x, -y]) // Invert Y for DXF coordinate system
    
    // Add all valid neighbors for maximum detail
    for (const [dx, dy] of directions) {
      const nx = x + dx
      const ny = y + dy
      if (nx >= 0 && nx < width && ny >= 0 && ny < height && pixels[ny][nx] >= minLevel) {
        stack.push([nx, ny])
      }
    }
  }
  
  return contour
}

// Find edge contours for maximum detail
function findEdgeContours(pixels: number[][], width: number, height: number): number[][][] {
  const edgeContours: number[][][] = []
  const visited = new Set<string>()
  
  // Scan for edges (transitions between different gray levels)
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const current = pixels[y][x]
      
      // Check for significant transitions
      const neighbors = [
        pixels[y-1][x-1], pixels[y-1][x], pixels[y-1][x+1],
        pixels[y][x-1],                   pixels[y][x+1],
        pixels[y+1][x-1], pixels[y+1][x], pixels[y+1][x+1]
      ]
      
      let hasTransition = false
      for (const neighbor of neighbors) {
        if (Math.abs(current - neighbor) > 0.5) {
          hasTransition = true
          break
        }
      }
      
      if (hasTransition && !visited.has(`edge-${x},${y}`)) {
        const contour = traceEdgeContour(pixels, x, y, width, height, visited)
        if (contour.length > 2) {
          edgeContours.push(contour)
        }
      }
    }
  }
  
  return edgeContours
}

// Trace edge contours for fine details
function traceEdgeContour(pixels: number[][], startX: number, startY: number, width: number, height: number, visited: Set<string>): number[][] {
  const contour: number[][] = []
  const stack: number[][] = [[startX, startY]]
  
  const directions = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1],           [0, 1],
    [1, -1],  [1, 0],  [1, 1]
  ]
  
  while (stack.length > 0) {
    const [x, y] = stack.pop()!
    const key = `edge-${x},${y}`
    
    if (visited.has(key) || x < 0 || x >= width || y < 0 || y >= height) {
      continue
    }
    
    const current = pixels[y][x]
    let hasTransition = false
    
    // Check if this is an edge pixel
    for (const [dx, dy] of directions) {
      const nx = x + dx
      const ny = y + dy
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        const neighbor = pixels[ny][nx]
        if (Math.abs(current - neighbor) > 0.3) {
          hasTransition = true
          break
        }
      }
    }
    
    if (!hasTransition) continue
    
    visited.add(key)
    contour.push([x, -y])
    
    // Add neighboring edge pixels
    for (const [dx, dy] of directions) {
      const nx = x + dx
      const ny = y + dy
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        stack.push([nx, ny])
      }
    }
  }
  
  return contour
}

function traceContour(pixels: number[][], startX: number, startY: number, width: number, height: number, visited: Set<string>): number[][] {
  const contour: number[][] = []
  const stack: number[][] = [[startX, startY]]
  
  while (stack.length > 0) {
    const [x, y] = stack.pop()!
    const key = `${x},${y}`
    
    if (visited.has(key) || x < 0 || x >= width || y < 0 || y >= height || pixels[y][x] === 0) {
      continue
    }
    
    visited.add(key)
    contour.push([x, -y]) // Invert Y for DXF coordinate system
    
    // Add 8-connected neighbors
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue
        const nx = x + dx
        const ny = y + dy
        if (nx >= 0 && nx < width && ny >= 0 && ny < height && pixels[ny][nx] === 1) {
          stack.push([nx, ny])
        }
      }
    }
  }
  
  return contour
}

async function convertRasterToDxf(imageBuffer: Buffer, options: ConversionOptions = {}): Promise<string> {
  const { threshold = 128, simplify = 0.1 } = options
  
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

    const width = info.width
    const height = info.height
    
    // 2. Find contours using our improved edge-following algorithm
    const contours = findContours(imageData, width, height, threshold)
    
    // 3. Create DXF with contours as polylines
    const writer = new SimpleDxfWriter()
    
    // Create a single clean line from the boundary
    if (contours.length > 0 && contours[0].length > 2) {
      const boundary = contours[0]
      
      // Clean up the path for crisp lines
      const cleanedPath = cleanPath(boundary)
      
      // Apply smoothing to remove wavy lines
      const smoothedPath = smoothContour(cleanedPath)
      
      // Apply minimal simplification to preserve detail
      const simplifiedPath = simplify ? simplifyContour(smoothedPath, simplify * 0.3) : smoothedPath
      
      // Create as a single polyline
      writer.addPolyline(simplifiedPath, {
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
      storeInSupabase
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
