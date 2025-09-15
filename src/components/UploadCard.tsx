'use client'

import { useState, useRef, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'

interface ConversionSettings {
  threshold: number
  simplify: number
  storeInSupabase: boolean
  width: number
  height: number
  dimensionControl: 'width' | 'height'
}

interface ConversionResult {
  success: boolean
  filename?: string
  imageUrl?: string
  dxfUrl?: string
  error?: string
}

export default function UploadCard() {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [converting, setConverting] = useState(false)
  const [result, setResult] = useState<ConversionResult | null>(null)
  const [settings, setSettings] = useState<ConversionSettings>({
    threshold: 128,
    simplify: 0.1,
    storeInSupabase: false,
    width: 2.25, // Default width in inches (2 1/4")
    height: 0.75, // Default height in inches (3/4")
    dimensionControl: 'width' // Default to width control
  })
  const [widthInput, setWidthInput] = useState<string>('2.25')
  const [heightInput, setHeightInput] = useState<string>('0.75')
  
  const fileInputRef = useRef<HTMLInputElement>(null)

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0]
    if (file) {
      handleFileSelect(file)
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg']
    },
    maxSize: 10 * 1024 * 1024, // 10MB
    multiple: false,
    noClick: true // Disable click on dropzone area
  })

  const handleFileSelect = (selectedFile: File) => {
    setFile(selectedFile)
    setResult(null)
    
    // Create preview
    const reader = new FileReader()
    reader.onload = (e) => {
      setPreview(e.target?.result as string)
    }
    reader.readAsDataURL(selectedFile)
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      // Validate file size
      if (selectedFile.size > 10 * 1024 * 1024) {
        alert('File too large. Maximum size is 10MB.')
        return
      }
      // Validate file type
      if (!selectedFile.type.startsWith('image/')) {
        alert('Please select an image file (PNG or JPEG).')
        return
      }
      handleFileSelect(selectedFile)
    }
  }

  const convertToDxf = async () => {
    if (!file) return

    setConverting(true)
    setResult(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('threshold', settings.threshold.toString())
      formData.append('simplify', settings.simplify.toString())
      formData.append('storeInSupabase', settings.storeInSupabase.toString())
      formData.append('width', settings.width.toString())
      formData.append('height', settings.height.toString())
      formData.append('dimensionControl', settings.dimensionControl)

      const response = await fetch('/api/convert', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Conversion failed')
      }

      // Get storage URLs from headers if available
      const imageUrl = response.headers.get('X-Image-URL')
      const dxfUrl = response.headers.get('X-DXF-URL')

      // Download the DXF file
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = file.name.replace(/\.[^/.]+$/, '') + '.dxf'
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)

      setResult({
        success: true,
        filename: file.name.replace(/\.[^/.]+$/, '') + '.dxf',
        imageUrl: imageUrl || undefined,
        dxfUrl: dxfUrl || undefined
      })

    } catch (error) {
      console.error('Conversion error:', error)
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Conversion failed'
      })
    } finally {
      setConverting(false)
    }
  }

  const reset = () => {
    setFile(null)
    setPreview(null)
    setResult(null)
    setConverting(false)
    setWidthInput('2.25')
    setHeightInput('0.75')
    setSettings(prev => ({ ...prev, width: 2.25, height: 0.75, dimensionControl: 'width' }))
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="text-center">
          <h1 className="text-4xl font-black tracking-tight">
            <span className="text-red-600">S</span>
            <span className="text-black">n</span>
            <span className="text-red-600">a</span>
            <span className="text-black">p</span>
            <span className="text-red-600">2</span>
            <span className="text-black">D</span>
            <span className="text-red-600">X</span>
            <span className="text-black">F</span>
          </h1>
          <p className="text-sm font-bold text-black mt-1 underline">
            <a href="https://cabinetexplore.com" target="_blank" rel="noopener noreferrer" className="hover:text-red-600 transition-colors">
              From Cabinet Explore
            </a>
          </p>
        </div>
        <p className="text-gray-600 mt-3">Easily Convert PNG/JPEG screenshots to DXF files</p>
      </div>

      {/* Upload Area */}
      <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
        {!file ? (
          <div className="space-y-4">
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                isDragActive
                  ? 'border-blue-400 bg-blue-50'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              <input {...getInputProps()} ref={fileInputRef} />
              <div className="space-y-4">
                <div className="text-6xl text-gray-400">📷</div>
                <div>
                  <p className="text-lg font-medium text-gray-900">
                    {isDragActive ? 'Drop your image here' : 'Drag & drop an image'}
                  </p>
                  <p className="text-gray-500">or click to browse</p>
                </div>
                <p className="text-sm text-gray-400">
                  Supports PNG, JPEG • Max 10MB
                </p>
              </div>
            </div>
            
            {/* Separate clickable button */}
            <div className="text-center">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileInputChange}
                accept="image/png,image/jpeg"
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Choose File
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Preview */}
            <div className="text-center relative">
              {preview && (
                <img
                  src={preview}
                  alt="Preview"
                  className="max-w-full max-h-64 mx-auto rounded-lg shadow-sm"
                />
              )}
              <button
                onClick={reset}
                className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-red-600 transition-colors"
                title="Remove file"
              >
                ×
              </button>
              <p className="text-sm text-gray-500 mt-2">{file.name}</p>
            </div>

            {/* Settings */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Threshold: {settings.threshold}
                </label>
                <input
                  type="range"
                  min="0"
                  max="255"
                  value={settings.threshold}
                  onChange={(e) => setSettings(prev => ({ ...prev, threshold: parseInt(e.target.value) }))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Light</span>
                  <span>Dark</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Simplify: {settings.simplify.toFixed(2)}
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={settings.simplify}
                  onChange={(e) => setSettings(prev => ({ ...prev, simplify: parseFloat(e.target.value) }))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Complex</span>
                  <span>Simple</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  DXF Dimensions
                </label>
                
                {/* Toggle for width vs height control */}
                <div className="flex mb-3">
                  <button
                    type="button"
                    onClick={() => setSettings(prev => ({ ...prev, dimensionControl: 'width' }))}
                    className={`px-4 py-2 text-sm font-medium rounded-l-lg border ${
                      settings.dimensionControl === 'width'
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    Control Width
                  </button>
                  <button
                    type="button"
                    onClick={() => setSettings(prev => ({ ...prev, dimensionControl: 'height' }))}
                    className={`px-4 py-2 text-sm font-medium rounded-r-lg border-t border-r border-b ${
                      settings.dimensionControl === 'height'
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    Control Height
                  </button>
                </div>

                {/* Width input (shown when width control is selected) */}
                {settings.dimensionControl === 'width' && (
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={widthInput}
                      onChange={(e) => {
                        const inputValue = e.target.value
                        setWidthInput(inputValue)
                        
                        // Only update the actual settings when we have a valid number
                        const value = parseFloat(inputValue)
                        if (!isNaN(value) && value > 0) {
                          setSettings(prev => ({ ...prev, width: value }))
                        }
                      }}
                      onBlur={() => {
                        // On blur, ensure we have a valid value, otherwise reset to current settings
                        const value = parseFloat(widthInput)
                        if (isNaN(value) || value <= 0) {
                          setWidthInput(settings.width.toString())
                        }
                      }}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter width in inches (e.g., 2.25)"
                    />
                    <span className="text-sm text-gray-500">"</span>
                  </div>
                )}

                {/* Height input (shown when height control is selected) */}
                {settings.dimensionControl === 'height' && (
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={heightInput}
                      onChange={(e) => {
                        const inputValue = e.target.value
                        setHeightInput(inputValue)
                        
                        // Only update the actual settings when we have a valid number
                        const value = parseFloat(inputValue)
                        if (!isNaN(value) && value > 0) {
                          setSettings(prev => ({ ...prev, height: value }))
                        }
                      }}
                      onBlur={() => {
                        // On blur, ensure we have a valid value, otherwise reset to current settings
                        const value = parseFloat(heightInput)
                        if (isNaN(value) || value <= 0) {
                          setHeightInput(settings.height.toString())
                        }
                      }}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter height in inches (e.g., 0.75)"
                    />
                    <span className="text-sm text-gray-500">"</span>
                  </div>
                )}

                <div className="text-xs text-gray-500 mt-1">
                  {settings.dimensionControl === 'width' 
                    ? 'Width will be set to your value, height will scale proportionally'
                    : 'Height will be set to your value, width will scale proportionally'
                  }
                </div>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="storeInSupabase"
                  checked={settings.storeInSupabase}
                  onChange={(e) => setSettings(prev => ({ ...prev, storeInSupabase: e.target.checked }))}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="storeInSupabase" className="ml-2 text-sm text-gray-700">
                  Store in cloud and get shareable link
                  <span className="text-xs text-gray-500 block">
                    (Requires Supabase configuration)
                  </span>
                </label>
              </div>
            </div>

            {/* Actions */}
            <div className="flex space-x-3">
              <button
                onClick={convertToDxf}
                disabled={converting}
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {converting ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Converting...
                  </span>
                ) : (
                  'Convert to DXF'
                )}
              </button>
              <button
                onClick={reset}
                disabled={converting}
                className="px-4 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Remove File
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Result */}
      {result && (
        <div className={`rounded-lg p-4 ${result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
          {result.success ? (
            <div className="text-center">
              <div className="text-green-600 text-lg font-medium mb-2">✅ Conversion successful!</div>
              <p className="text-green-700 mb-2">Your DXF file has been downloaded.</p>
              {result.dxfUrl && (
                <div className="space-y-2">
                  <p className="text-sm text-green-600">Shareable link:</p>
                  <a
                    href={result.dxfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:text-blue-800 underline break-all"
                  >
                    {result.dxfUrl}
                  </a>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center">
              <div className="text-red-600 text-lg font-medium mb-2">❌ Conversion failed</div>
              <p className="text-red-700">{result.error}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
