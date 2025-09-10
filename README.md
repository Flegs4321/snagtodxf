# Snap2DXF

A simple, clean Next.js application that converts PNG/JPEG screenshots to DXF files for CAD applications. No login required - just upload, preview, convert, and download.

## Features

- 🖼️ **Drag & Drop Upload** - Easy file selection with preview
- ⚙️ **Conversion Settings** - Adjustable threshold and simplification
- ☁️ **Optional Cloud Storage** - Store files in Supabase with shareable links
- 📱 **Mobile Friendly** - Responsive design that works on all devices
- 🚀 **Fast Conversion** - Optimized image processing with Sharp
- 🎯 **DXF Output** - Clean vector output ready for CAD software

## Tech Stack

- **Frontend**: Next.js 15, React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes
- **Image Processing**: Sharp, Potrace
- **Storage**: Supabase (optional)
- **File Handling**: Formidable, react-dropzone

## Quick Start

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd snagtodxf
npm install
```

### 2. Environment Setup

Create a `.env.local` file in the root directory:

```env
# Supabase Configuration (optional)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here

# App Configuration
MAX_FILE_SIZE=10485760
MAX_IMAGE_DIMENSION=2000
```

### 3. Supabase Setup (Optional)

If you want to use cloud storage:

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to Storage and create a new bucket called `snap2dxf-outputs`
3. Set the bucket to public
4. Copy your project URL and anon key to `.env.local`

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

1. **Upload**: Drag and drop a PNG or JPEG image (max 10MB)
2. **Preview**: See your image with conversion settings
3. **Adjust**: Use the threshold and simplify sliders to fine-tune
4. **Convert**: Click "Convert to DXF" to process your image
5. **Download**: Your DXF file will automatically download

### Conversion Settings

- **Threshold** (0-255): Controls the black/white conversion threshold
  - Lower values = more black areas
  - Higher values = more white areas
- **Simplify** (0-1): Controls path simplification
  - Lower values = more detailed paths
  - Higher values = simpler, smoother paths

## API Endpoints

### POST `/api/convert`

Converts an uploaded image to DXF format.

**Request:**
- `file`: Image file (multipart/form-data)
- `threshold`: Number (0-255, default: 128)
- `simplify`: Number (0-1, default: 0.1)
- `storeInSupabase`: Boolean (default: false)

**Response:**
- Returns DXF file as download
- Optional headers: `X-Image-URL`, `X-DXF-URL` (if stored in Supabase)

### GET `/api/health`

Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "service": "Snap2DXF API"
}
```

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy!

### Other Platforms

The app can be deployed to any platform that supports Next.js:
- Netlify
- Railway
- DigitalOcean App Platform
- AWS Amplify

## Development

### Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── convert/route.ts    # Image conversion API
│   │   └── health/route.ts     # Health check API
│   ├── layout.tsx              # Root layout
│   └── page.tsx                # Home page
├── components/
│   └── UploadCard.tsx          # Main upload component
└── lib/
    └── supabase.ts             # Supabase configuration
```

### Key Dependencies

- `sharp`: Image processing and optimization
- `potrace`: Raster to vector conversion
- `svg-path-parser`: SVG path parsing
- `dxf-writer`: DXF file generation
- `react-dropzone`: Drag and drop file upload
- `@supabase/supabase-js`: Supabase client

### Adding Features

1. **New conversion options**: Modify the `ConversionOptions` interface and API route
2. **Additional file formats**: Update the dropzone accept prop and API validation
3. **Batch processing**: Extend the API to handle multiple files
4. **User accounts**: Add authentication with Supabase Auth

## Troubleshooting

### Common Issues

**"Conversion failed" error:**
- Check that your image has clear contrast
- Try adjusting the threshold setting
- Ensure the image isn't too large (>10MB)

**Supabase storage not working:**
- Verify your environment variables are correct
- Check that the bucket exists and is public
- Ensure you have the correct service role key

**DXF file won't open in CAD software:**
- Try different threshold/simplify settings
- Ensure your original image has clear black/white contrast
- Some CAD software may require specific DXF versions

### Performance Tips

- Keep images under 2000px on the longest side
- Use PNG for better quality with screenshots
- Adjust simplify setting for balance between detail and file size

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## License

This project is open source and available under the [MIT License](LICENSE).

## Support

If you encounter any issues or have questions:

1. Check the troubleshooting section above
2. Search existing GitHub issues
3. Create a new issue with detailed information about your problem

---

**Made with ❤️ for the CAD community**