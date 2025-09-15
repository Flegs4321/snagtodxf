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
  width?: number
  height?: number
  dimensionControl?: 'width' | 'height'
}

// Robust DXF writer following DXF standard
class SimpleDxfWriter {
  private content: string[] = []
  
  constructor() {
    this.initializeDxf()
  }
  
  private initializeDxf() {
    // DXF Header Section
    this.content.push('0')
    this.content.push('SECTION')
    this.content.push('2')
    this.content.push('HEADER')
    
    // Required header variables
    this.addHeaderVar('$ACADVER', 'AC1015') // AutoCAD 2000 format for maximum compatibility
    this.addHeaderVar('$HANDSEED', 'FFFF')
    this.addHeaderVar('$MEASUREMENT', '0') // English units
    this.addHeaderVar('$INSUNITS', '1') // Inches (but coordinates are in hundredths)
    this.addHeaderVar('$LUNITS', '2') // Decimal
    this.addHeaderVar('$LUPREC', '4') // 4 decimal places
    this.addHeaderVar('$AUNITS', '0') // Decimal degrees
    this.addHeaderVar('$AUPREC', '0') // 0 decimal places for angles
    this.addHeaderVar('$ORTHOMODE', '0')
    this.addHeaderVar('$REGENMODE', '1')
    this.addHeaderVar('$FILLMODE', '1')
    this.addHeaderVar('$QTEXTMODE', '0')
    this.addHeaderVar('$MIRRTEXT', '0')
    this.addHeaderVar('$DRAGMODE', '2')
    this.addHeaderVar('$LTSCALE', '1.0')
    this.addHeaderVar('$OSMODE', '0')
    this.addHeaderVar('$ATTMODE', '1')
    this.addHeaderVar('$TEXTSIZE', '0.2')
    this.addHeaderVar('$TRACEWID', '0.05')
    this.addHeaderVar('$TEXTSTYLE', 'STANDARD')
    this.addHeaderVar('$CLAYER', '0')
    this.addHeaderVar('$CELTYPE', 'BYLAYER')
    this.addHeaderVar('$CECOLOR', '256')
    this.addHeaderVar('$CELTSCALE', '1.0')
    this.addHeaderVar('$DISPSILH', '0')
    this.addHeaderVar('$DIMSCALE', '1.0')
    this.addHeaderVar('$DIMASZ', '0.18')
    this.addHeaderVar('$DIMEXO', '0.0625')
    this.addHeaderVar('$DIMDLI', '0.38')
    this.addHeaderVar('$DIMRND', '0.0')
    this.addHeaderVar('$DIMDLE', '0.0')
    this.addHeaderVar('$DIMEXE', '0.18')
    this.addHeaderVar('$DIMTP', '0.0')
    this.addHeaderVar('$DIMTM', '0.0')
    this.addHeaderVar('$DIMTXT', '0.18')
    this.addHeaderVar('$DIMCEN', '0.09')
    this.addHeaderVar('$DIMTSZ', '0.0')
    this.addHeaderVar('$DIMTOL', '0')
    this.addHeaderVar('$DIMLIM', '0')
    this.addHeaderVar('$DIMTIH', '0')
    this.addHeaderVar('$DIMTOH', '0')
    this.addHeaderVar('$DIMSE1', '0')
    this.addHeaderVar('$DIMSE2', '0')
    this.addHeaderVar('$DIMTAD', '0')
    this.addHeaderVar('$DIMZIN', '0')
    this.addHeaderVar('$DIMBLK', '')
    this.addHeaderVar('$DIMASO', '1')
    this.addHeaderVar('$DIMSHO', '0')
    this.addHeaderVar('$DIMPOST', '')
    this.addHeaderVar('$DIMAPOST', '')
    this.addHeaderVar('$DIMALT', '0')
    this.addHeaderVar('$DIMALTD', '2')
    this.addHeaderVar('$DIMALTF', '25.4')
    this.addHeaderVar('$DIMLFAC', '1.0')
    this.addHeaderVar('$DIMTOFL', '0')
    this.addHeaderVar('$DIMTVP', '0.0')
    this.addHeaderVar('$DIMTIX', '0')
    this.addHeaderVar('$DIMSOXD', '0')
    this.addHeaderVar('$DIMSAH', '0')
    this.addHeaderVar('$DIMBLK1', '')
    this.addHeaderVar('$DIMBLK2', '')
    this.addHeaderVar('$DIMSTYLE', 'STANDARD')
    this.addHeaderVar('$DIMCLRD', '0')
    this.addHeaderVar('$DIMCLRE', '0')
    this.addHeaderVar('$DIMCLRT', '0')
    this.addHeaderVar('$DIMTFAC', '1.0')
    this.addHeaderVar('$DIMGAP', '0.09')
    this.addHeaderVar('$DIMJUST', '0')
    this.addHeaderVar('$DIMSD1', '0')
    this.addHeaderVar('$DIMSD2', '0')
    this.addHeaderVar('$DIMTOLJ', '0')
    this.addHeaderVar('$DIMTZIN', '0')
    this.addHeaderVar('$DIMALTZ', '0')
    this.addHeaderVar('$DIMALTTZ', '0')
    this.addHeaderVar('$DIMUPT', '0')
    this.addHeaderVar('$DIMDEC', '4')
    this.addHeaderVar('$DIMTDEC', '4')
    this.addHeaderVar('$DIMALTU', '2')
    this.addHeaderVar('$DIMALTTD', '2')
    this.addHeaderVar('$DIMTXSTY', 'STANDARD')
    this.addHeaderVar('$DIMAUNIT', '0')
    this.addHeaderVar('$DIMADEC', '0')
    this.addHeaderVar('$DIMALTRND', '0.0')
    this.addHeaderVar('$DIMAZIN', '0')
    this.addHeaderVar('$DIMDSEP', '.')
    this.addHeaderVar('$DIMATFIT', '3')
    this.addHeaderVar('$DIMFRAC', '0')
    this.addHeaderVar('$DIMLDRBLK', '')
    this.addHeaderVar('$DIMLUNIT', '2')
    this.addHeaderVar('$DIMLWD', '-2')
    this.addHeaderVar('$DIMLWE', '-2')
    this.addHeaderVar('$DIMTMOVE', '0')
    this.addHeaderVar('$DIMFXL', '1.0')
    this.addHeaderVar('$DIMFXLON', '0')
    this.addHeaderVar('$DIMJOGANG', '0.7853981633974483')
    this.addHeaderVar('$DIMTFILL', '0')
    this.addHeaderVar('$DIMTFILLCLR', '0')
    this.addHeaderVar('$DIMARCSYM', '0')
    this.addHeaderVar('$DIMLTYPE', '')
    this.addHeaderVar('$DIMLTEX1', '')
    this.addHeaderVar('$DIMLTEX2', '')
    this.addHeaderVar('$DIMTXTDIRECTION', '0')
    this.addHeaderVar('$LUNITS', '2')
    this.addHeaderVar('$LUPREC', '4')
    this.addHeaderVar('$AUNITS', '0')
    this.addHeaderVar('$AUPREC', '0')
    this.addHeaderVar('$ORTHOMODE', '0')
    this.addHeaderVar('$REGENMODE', '1')
    this.addHeaderVar('$FILLMODE', '1')
    this.addHeaderVar('$QTEXTMODE', '0')
    this.addHeaderVar('$MIRRTEXT', '0')
    this.addHeaderVar('$DRAGMODE', '2')
    this.addHeaderVar('$LTSCALE', '1.0')
    this.addHeaderVar('$OSMODE', '0')
    this.addHeaderVar('$ATTMODE', '1')
    this.addHeaderVar('$TEXTSIZE', '0.2')
    this.addHeaderVar('$TRACEWID', '0.05')
    this.addHeaderVar('$TEXTSTYLE', 'STANDARD')
    this.addHeaderVar('$CLAYER', '0')
    this.addHeaderVar('$CELTYPE', 'BYLAYER')
    this.addHeaderVar('$CECOLOR', '256')
    this.addHeaderVar('$CELTSCALE', '1.0')
    this.addHeaderVar('$DISPSILH', '0')
    this.addHeaderVar('$DIMSCALE', '1.0')
    this.addHeaderVar('$DIMASZ', '0.18')
    this.addHeaderVar('$DIMEXO', '0.0625')
    this.addHeaderVar('$DIMDLI', '0.38')
    this.addHeaderVar('$DIMRND', '0.0')
    this.addHeaderVar('$DIMDLE', '0.0')
    this.addHeaderVar('$DIMEXE', '0.18')
    this.addHeaderVar('$DIMTP', '0.0')
    this.addHeaderVar('$DIMTM', '0.0')
    this.addHeaderVar('$DIMTXT', '0.18')
    this.addHeaderVar('$DIMCEN', '0.09')
    this.addHeaderVar('$DIMTSZ', '0.0')
    this.addHeaderVar('$DIMTOL', '0')
    this.addHeaderVar('$DIMLIM', '0')
    this.addHeaderVar('$DIMTIH', '0')
    this.addHeaderVar('$DIMTOH', '0')
    this.addHeaderVar('$DIMSE1', '0')
    this.addHeaderVar('$DIMSE2', '0')
    this.addHeaderVar('$DIMTAD', '0')
    this.addHeaderVar('$DIMZIN', '0')
    this.addHeaderVar('$DIMBLK', '')
    this.addHeaderVar('$DIMASO', '1')
    this.addHeaderVar('$DIMSHO', '0')
    this.addHeaderVar('$DIMPOST', '')
    this.addHeaderVar('$DIMAPOST', '')
    this.addHeaderVar('$DIMALT', '0')
    this.addHeaderVar('$DIMALTD', '2')
    this.addHeaderVar('$DIMALTF', '25.4')
    this.addHeaderVar('$DIMLFAC', '1.0')
    this.addHeaderVar('$DIMTOFL', '0')
    this.addHeaderVar('$DIMTVP', '0.0')
    this.addHeaderVar('$DIMTIX', '0')
    this.addHeaderVar('$DIMSOXD', '0')
    this.addHeaderVar('$DIMSAH', '0')
    this.addHeaderVar('$DIMBLK1', '')
    this.addHeaderVar('$DIMBLK2', '')
    this.addHeaderVar('$DIMSTYLE', 'STANDARD')
    this.addHeaderVar('$DIMCLRD', '0')
    this.addHeaderVar('$DIMCLRE', '0')
    this.addHeaderVar('$DIMCLRT', '0')
    this.addHeaderVar('$DIMTFAC', '1.0')
    this.addHeaderVar('$DIMGAP', '0.09')
    this.addHeaderVar('$DIMJUST', '0')
    this.addHeaderVar('$DIMSD1', '0')
    this.addHeaderVar('$DIMSD2', '0')
    this.addHeaderVar('$DIMTOLJ', '0')
    this.addHeaderVar('$DIMTZIN', '0')
    this.addHeaderVar('$DIMALTZ', '0')
    this.addHeaderVar('$DIMALTTZ', '0')
    this.addHeaderVar('$DIMUPT', '0')
    this.addHeaderVar('$DIMDEC', '4')
    this.addHeaderVar('$DIMTDEC', '4')
    this.addHeaderVar('$DIMALTU', '2')
    this.addHeaderVar('$DIMALTTD', '2')
    this.addHeaderVar('$DIMTXSTY', 'STANDARD')
    this.addHeaderVar('$DIMAUNIT', '0')
    this.addHeaderVar('$DIMADEC', '0')
    this.addHeaderVar('$DIMALTRND', '0.0')
    this.addHeaderVar('$DIMAZIN', '0')
    this.addHeaderVar('$DIMDSEP', '.')
    this.addHeaderVar('$DIMATFIT', '3')
    this.addHeaderVar('$DIMFRAC', '0')
    this.addHeaderVar('$DIMLDRBLK', '')
    this.addHeaderVar('$DIMLUNIT', '2')
    this.addHeaderVar('$DIMLWD', '-2')
    this.addHeaderVar('$DIMLWE', '-2')
    this.addHeaderVar('$DIMTMOVE', '0')
    this.addHeaderVar('$DIMFXL', '1.0')
    this.addHeaderVar('$DIMFXLON', '0')
    this.addHeaderVar('$DIMJOGANG', '0.7853981633974483')
    this.addHeaderVar('$DIMTFILL', '0')
    this.addHeaderVar('$DIMTFILLCLR', '0')
    this.addHeaderVar('$DIMARCSYM', '0')
    this.addHeaderVar('$DIMLTYPE', '')
    this.addHeaderVar('$DIMLTEX1', '')
    this.addHeaderVar('$DIMLTEX2', '')
    this.addHeaderVar('$DIMTXTDIRECTION', '0')
    
    // End header section
    this.content.push('0')
    this.content.push('ENDSEC')
    
    // Tables section
    this.content.push('0')
    this.content.push('SECTION')
    this.content.push('2')
    this.content.push('TABLES')
    
    // Viewport table
    this.content.push('0')
    this.content.push('TABLE')
    this.content.push('2')
    this.content.push('VPORT')
    this.content.push('5')
    this.content.push('8')
    this.content.push('330')
    this.content.push('0')
    this.content.push('100')
    this.content.push('AcDbSymbolTable')
    this.content.push('70')
    this.content.push('1')
    this.content.push('0')
    this.content.push('VPORT')
    this.content.push('5')
    this.content.push('2E')
    this.content.push('330')
    this.content.push('8')
    this.content.push('100')
    this.content.push('AcDbSymbolTableRecord')
    this.content.push('100')
    this.content.push('AcDbViewportTableRecord')
    this.content.push('2')
    this.content.push('*ACTIVE')
    this.content.push('70')
    this.content.push('0')
    this.content.push('10')
    this.content.push('0.0')
    this.content.push('20')
    this.content.push('0.0')
    this.content.push('11')
    this.content.push('1.0')
    this.content.push('21')
    this.content.push('1.0')
    this.content.push('12')
    this.content.push('0.0')
    this.content.push('22')
    this.content.push('0.0')
    this.content.push('13')
    this.content.push('0.0')
    this.content.push('23')
    this.content.push('0.0')
    this.content.push('14')
    this.content.push('10.0')
    this.content.push('24')
    this.content.push('10.0')
    this.content.push('15')
    this.content.push('0.0')
    this.content.push('25')
    this.content.push('0.0')
    this.content.push('16')
    this.content.push('0.0')
    this.content.push('26')
    this.content.push('0.0')
    this.content.push('36')
    this.content.push('1.0')
    this.content.push('17')
    this.content.push('0.0')
    this.content.push('27')
    this.content.push('0.0')
    this.content.push('37')
    this.content.push('0.0')
    this.content.push('40')
    this.content.push('0.0')
    this.content.push('41')
    this.content.push('1.0')
    this.content.push('42')
    this.content.push('50.0')
    this.content.push('43')
    this.content.push('0.0')
    this.content.push('44')
    this.content.push('0.0')
    this.content.push('50')
    this.content.push('0.0')
    this.content.push('51')
    this.content.push('0.0')
    this.content.push('71')
    this.content.push('0')
    this.content.push('72')
    this.content.push('100')
    this.content.push('73')
    this.content.push('1')
    this.content.push('74')
    this.content.push('3')
    this.content.push('75')
    this.content.push('0')
    this.content.push('76')
    this.content.push('0')
    this.content.push('77')
    this.content.push('0')
    this.content.push('78')
    this.content.push('0')
    this.content.push('281')
    this.content.push('0')
    this.content.push('65')
    this.content.push('1')
    this.content.push('110')
    this.content.push('0.0')
    this.content.push('120')
    this.content.push('0.0')
    this.content.push('130')
    this.content.push('0.0')
    this.content.push('111')
    this.content.push('1.0')
    this.content.push('121')
    this.content.push('0.0')
    this.content.push('131')
    this.content.push('0.0')
    this.content.push('112')
    this.content.push('0.0')
    this.content.push('122')
    this.content.push('1.0')
    this.content.push('132')
    this.content.push('0.0')
    this.content.push('79')
    this.content.push('0')
    this.content.push('146')
    this.content.push('0.0')
    this.content.push('0')
    this.content.push('ENDTAB')
    
    // Linetype table
    this.content.push('0')
    this.content.push('TABLE')
    this.content.push('2')
    this.content.push('LTYPE')
    this.content.push('5')
    this.content.push('5')
    this.content.push('330')
    this.content.push('0')
    this.content.push('100')
    this.content.push('AcDbSymbolTable')
    this.content.push('70')
    this.content.push('1')
    this.content.push('0')
    this.content.push('LTYPE')
    this.content.push('5')
    this.content.push('14')
    this.content.push('330')
    this.content.push('5')
    this.content.push('100')
    this.content.push('AcDbSymbolTableRecord')
    this.content.push('100')
    this.content.push('AcDbLinetypeTableRecord')
    this.content.push('2')
    this.content.push('BYBLOCK')
    this.content.push('70')
    this.content.push('0')
    this.content.push('3')
    this.content.push('')
    this.content.push('72')
    this.content.push('65')
    this.content.push('73')
    this.content.push('0')
    this.content.push('40')
    this.content.push('0.0')
    this.content.push('0')
    this.content.push('LTYPE')
    this.content.push('5')
    this.content.push('15')
    this.content.push('330')
    this.content.push('5')
    this.content.push('100')
    this.content.push('AcDbSymbolTableRecord')
    this.content.push('100')
    this.content.push('AcDbLinetypeTableRecord')
    this.content.push('2')
    this.content.push('BYLAYER')
    this.content.push('70')
    this.content.push('0')
    this.content.push('3')
    this.content.push('')
    this.content.push('72')
    this.content.push('65')
    this.content.push('73')
    this.content.push('0')
    this.content.push('40')
    this.content.push('0.0')
    this.content.push('0')
    this.content.push('LTYPE')
    this.content.push('5')
    this.content.push('16')
    this.content.push('330')
    this.content.push('5')
    this.content.push('100')
    this.content.push('AcDbSymbolTableRecord')
    this.content.push('100')
    this.content.push('AcDbLinetypeTableRecord')
    this.content.push('2')
    this.content.push('CONTINUOUS')
    this.content.push('70')
    this.content.push('0')
    this.content.push('3')
    this.content.push('Solid line')
    this.content.push('72')
    this.content.push('65')
    this.content.push('73')
    this.content.push('0')
    this.content.push('40')
    this.content.push('0.0')
    this.content.push('0')
    this.content.push('ENDTAB')
    
    // Layer table
    this.content.push('0')
    this.content.push('TABLE')
    this.content.push('2')
    this.content.push('LAYER')
    this.content.push('5')
    this.content.push('2')
    this.content.push('330')
    this.content.push('0')
    this.content.push('100')
    this.content.push('AcDbSymbolTable')
    this.content.push('70')
    this.content.push('1')
    this.content.push('0')
    this.content.push('LAYER')
    this.content.push('5')
    this.content.push('10')
    this.content.push('330')
    this.content.push('2')
    this.content.push('100')
    this.content.push('AcDbSymbolTableRecord')
    this.content.push('100')
    this.content.push('AcDbLayerTableRecord')
    this.content.push('2')
    this.content.push('0')
    this.content.push('70')
    this.content.push('0')
    this.content.push('6')
    this.content.push('CONTINUOUS')
    this.content.push('62')
    this.content.push('7')
    this.content.push('0')
    this.content.push('ENDTAB')
    
    // Style table
    this.content.push('0')
    this.content.push('TABLE')
    this.content.push('2')
    this.content.push('STYLE')
    this.content.push('5')
    this.content.push('3')
    this.content.push('330')
    this.content.push('0')
    this.content.push('100')
    this.content.push('AcDbSymbolTable')
    this.content.push('70')
    this.content.push('1')
    this.content.push('0')
    this.content.push('STYLE')
    this.content.push('5')
    this.content.push('11')
    this.content.push('330')
    this.content.push('3')
    this.content.push('100')
    this.content.push('AcDbSymbolTableRecord')
    this.content.push('100')
    this.content.push('AcDbTextStyleTableRecord')
    this.content.push('2')
    this.content.push('STANDARD')
    this.content.push('70')
    this.content.push('0')
    this.content.push('40')
    this.content.push('0.0')
    this.content.push('41')
    this.content.push('1.0')
    this.content.push('50')
    this.content.push('0.0')
    this.content.push('71')
    this.content.push('0')
    this.content.push('42')
    this.content.push('2.5')
    this.content.push('3')
    this.content.push('txt')
    this.content.push('4')
    this.content.push('')
    this.content.push('0')
    this.content.push('ENDTAB')
    
    // View table
    this.content.push('0')
    this.content.push('TABLE')
    this.content.push('2')
    this.content.push('VIEW')
    this.content.push('5')
    this.content.push('6')
    this.content.push('330')
    this.content.push('0')
    this.content.push('100')
    this.content.push('AcDbSymbolTable')
    this.content.push('70')
    this.content.push('0')
    this.content.push('0')
    this.content.push('ENDTAB')
    
    // UCS table
    this.content.push('0')
    this.content.push('TABLE')
    this.content.push('2')
    this.content.push('UCS')
    this.content.push('5')
    this.content.push('7')
    this.content.push('330')
    this.content.push('0')
    this.content.push('100')
    this.content.push('AcDbSymbolTable')
    this.content.push('70')
    this.content.push('0')
    this.content.push('0')
    this.content.push('ENDTAB')
    
    // AppID table
    this.content.push('0')
    this.content.push('TABLE')
    this.content.push('2')
    this.content.push('APPID')
    this.content.push('5')
    this.content.push('9')
    this.content.push('330')
    this.content.push('0')
    this.content.push('100')
    this.content.push('AcDbSymbolTable')
    this.content.push('70')
    this.content.push('2')
    this.content.push('0')
    this.content.push('APPID')
    this.content.push('5')
    this.content.push('12')
    this.content.push('330')
    this.content.push('9')
    this.content.push('100')
    this.content.push('AcDbSymbolTableRecord')
    this.content.push('100')
    this.content.push('AcDbRegAppTableRecord')
    this.content.push('2')
    this.content.push('ACAD')
    this.content.push('70')
    this.content.push('0')
    this.content.push('0')
    this.content.push('ENDTAB')
    
    // DIMSTYLE table
    this.content.push('0')
    this.content.push('TABLE')
    this.content.push('2')
    this.content.push('DIMSTYLE')
    this.content.push('5')
    this.content.push('A')
    this.content.push('330')
    this.content.push('0')
    this.content.push('100')
    this.content.push('AcDbSymbolTable')
    this.content.push('70')
    this.content.push('1')
    this.content.push('0')
    this.content.push('DIMSTYLE')
    this.content.push('105')
    this.content.push('27')
    this.content.push('330')
    this.content.push('A')
    this.content.push('100')
    this.content.push('AcDbSymbolTableRecord')
    this.content.push('100')
    this.content.push('AcDbDimStyleTableRecord')
    this.content.push('2')
    this.content.push('STANDARD')
    this.content.push('70')
    this.content.push('0')
    this.content.push('0')
    this.content.push('ENDTAB')
    
    // BLOCK_RECORD table
    this.content.push('0')
    this.content.push('TABLE')
    this.content.push('2')
    this.content.push('BLOCK_RECORD')
    this.content.push('5')
    this.content.push('1')
    this.content.push('330')
    this.content.push('0')
    this.content.push('100')
    this.content.push('AcDbSymbolTable')
    this.content.push('70')
    this.content.push('1')
    this.content.push('0')
    this.content.push('BLOCK_RECORD')
    this.content.push('5')
    this.content.push('1F')
    this.content.push('330')
    this.content.push('1')
    this.content.push('100')
    this.content.push('AcDbSymbolTableRecord')
    this.content.push('100')
    this.content.push('AcDbBlockTableRecord')
    this.content.push('2')
    this.content.push('*MODEL_SPACE')
    this.content.push('0')
    this.content.push('BLOCK_RECORD')
    this.content.push('5')
    this.content.push('1B')
    this.content.push('330')
    this.content.push('1')
    this.content.push('100')
    this.content.push('AcDbSymbolTableRecord')
    this.content.push('100')
    this.content.push('AcDbBlockTableRecord')
    this.content.push('2')
    this.content.push('*PAPER_SPACE')
    this.content.push('0')
    this.content.push('ENDTAB')
    
    // End tables section
    this.content.push('0')
    this.content.push('ENDSEC')
    
    // Blocks section
    this.content.push('0')
    this.content.push('SECTION')
    this.content.push('2')
    this.content.push('BLOCKS')
    this.content.push('0')
    this.content.push('BLOCK')
    this.content.push('5')
    this.content.push('20')
    this.content.push('330')
    this.content.push('1F')
    this.content.push('100')
    this.content.push('AcDbEntity')
    this.content.push('8')
    this.content.push('0')
    this.content.push('100')
    this.content.push('AcDbBlockBegin')
    this.content.push('2')
    this.content.push('*MODEL_SPACE')
    this.content.push('70')
    this.content.push('0')
    this.content.push('10')
    this.content.push('0.0')
    this.content.push('20')
    this.content.push('0.0')
    this.content.push('30')
    this.content.push('0.0')
    this.content.push('3')
    this.content.push('*MODEL_SPACE')
    this.content.push('1')
    this.content.push('')
    this.content.push('0')
    this.content.push('ENDBLK')
    this.content.push('5')
    this.content.push('21')
    this.content.push('330')
    this.content.push('1F')
    this.content.push('100')
    this.content.push('AcDbEntity')
    this.content.push('8')
    this.content.push('0')
    this.content.push('100')
    this.content.push('AcDbBlockEnd')
    this.content.push('0')
    this.content.push('BLOCK')
    this.content.push('5')
    this.content.push('1C')
    this.content.push('330')
    this.content.push('1B')
    this.content.push('100')
    this.content.push('AcDbEntity')
    this.content.push('8')
    this.content.push('0')
    this.content.push('100')
    this.content.push('AcDbBlockBegin')
    this.content.push('2')
    this.content.push('*PAPER_SPACE')
    this.content.push('70')
    this.content.push('0')
    this.content.push('10')
    this.content.push('0.0')
    this.content.push('20')
    this.content.push('0.0')
    this.content.push('30')
    this.content.push('0.0')
    this.content.push('3')
    this.content.push('*PAPER_SPACE')
    this.content.push('1')
    this.content.push('')
    this.content.push('0')
    this.content.push('ENDBLK')
    this.content.push('5')
    this.content.push('22')
    this.content.push('330')
    this.content.push('1B')
    this.content.push('100')
    this.content.push('AcDbEntity')
    this.content.push('8')
    this.content.push('0')
    this.content.push('100')
    this.content.push('AcDbBlockEnd')
    this.content.push('0')
    this.content.push('ENDSEC')
    
    // Entities section
    this.content.push('0')
    this.content.push('SECTION')
    this.content.push('2')
    this.content.push('ENTITIES')
  }
  
  private addHeaderVar(name: string, value: string | number) {
    this.content.push('9')
    this.content.push(name)
    if (typeof value === 'number') {
      this.content.push('40')
      this.content.push(value.toString())
    } else {
      this.content.push('1')
      this.content.push(value)
    }
  }
  
  addPolyline(points: number[][], options: { layer: string; closed: boolean } = { layer: '0', closed: false }) {
    if (points.length < 2) return
    
    console.log(`Creating DXF with ${points.length} points`)
    console.log(`First few points:`, points.slice(0, 3))
    console.log(`Last few points:`, points.slice(-3))
    
    // Clean up points to remove duplicates and very close points
    const cleanedPoints = this.cleanPoints(points)
    console.log(`Cleaned to ${cleanedPoints.length} points`)
    
    let lineCount = 0
    
    // Create individual LINE entities for maximum compatibility
    // Only create lines between consecutive points to avoid multiple overlapping lines
    for (let i = 0; i < cleanedPoints.length - 1; i++) {
      const current = cleanedPoints[i]
      const next = cleanedPoints[i + 1]
      
      // Skip if current and next points are identical or too close
      const dx = next[0] - current[0]
      const dy = next[1] - current[1]
      const distance = Math.sqrt(dx * dx + dy * dy)
      
      if (distance < 0.0001) { // Very small threshold to preserve shape details
        console.log(`Skipping short line segment at index ${i} (distance: ${distance})`)
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
      lineCount++
      
      // Debug: Log first few line coordinates
      if (lineCount <= 3) {
        console.log(`  Line ${lineCount}: (${current[0]}, ${current[1]}) to (${next[0]}, ${next[1]})`)
      }
    }
    
    console.log(`Created ${lineCount} line segments`)
    
    // If the path should be closed, add a line from the last point to the first point
    if (options.closed && cleanedPoints.length > 2) {
      const last = cleanedPoints[cleanedPoints.length - 1]
      const first = cleanedPoints[0]
      
      const dx = first[0] - last[0]
      const dy = first[1] - last[1]
      const distance = Math.sqrt(dx * dx + dy * dy)
      
      if (distance >= 0.0001) { // Only add closing line if there's a meaningful distance
        this.content.push('0')
        this.content.push('LINE')
        this.content.push('8')
        this.content.push(options.layer)
        this.content.push('10')
        this.content.push(last[0].toString())
        this.content.push('20')
        this.content.push(last[1].toString())
        this.content.push('30')
        this.content.push('0.0')
        this.content.push('11')
        this.content.push(first[0].toString())
        this.content.push('21')
        this.content.push(first[1].toString())
        this.content.push('31')
        this.content.push('0.0')
        lineCount++
        console.log(`Added closing line segment (total: ${lineCount})`)
      }
    }
  }
  
  // Clean up points to remove duplicates and very close points
  private cleanPoints(points: number[][]): number[][] {
    if (points.length < 2) return points
    
    const cleaned: number[][] = [points[0]]
    const minDistance = 0.001 // Reduced minimum distance to preserve more points
    
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
    
    // Remove any duplicate points that might have been created
    const finalCleaned: number[][] = []
    for (let i = 0; i < cleaned.length; i++) {
      const current = cleaned[i]
      const next = cleaned[(i + 1) % cleaned.length]
      
      const dx = next[0] - current[0]
      const dy = next[1] - current[1]
      const distance = Math.sqrt(dx * dx + dy * dy)
      
      if (distance >= minDistance) {
        finalCleaned.push(current)
      }
    }
    
    console.log(`Point cleaning: ${points.length} → ${finalCleaned.length} points`)
    console.log(`Sample cleaned points:`, finalCleaned.slice(0, 3))
    return finalCleaned
  }
  
  
  toString(): string {
    // End entities section
    this.content.push('0')
    this.content.push('ENDSEC')
    
    // Objects section (required for DXF)
    this.content.push('0')
    this.content.push('SECTION')
    this.content.push('2')
    this.content.push('OBJECTS')
    this.content.push('0')
    this.content.push('DICTIONARY')
    this.content.push('5')
    this.content.push('C')
    this.content.push('330')
    this.content.push('0')
    this.content.push('100')
    this.content.push('AcDbDictionary')
    this.content.push('3')
    this.content.push('ACAD_GROUP')
    this.content.push('350')
    this.content.push('D')
    this.content.push('3')
    this.content.push('ACAD_MLINESTYLE')
    this.content.push('350')
    this.content.push('17')
    this.content.push('0')
    this.content.push('DICTIONARY')
    this.content.push('5')
    this.content.push('D')
    this.content.push('102')
    this.content.push('{ACAD_REACTORS')
    this.content.push('330')
    this.content.push('C')
    this.content.push('102')
    this.content.push('}')
    this.content.push('330')
    this.content.push('C')
    this.content.push('100')
    this.content.push('AcDbDictionary')
    this.content.push('3')
    this.content.push('STANDARD')
    this.content.push('350')
    this.content.push('1A')
    this.content.push('0')
    this.content.push('MLINESTYLE')
    this.content.push('5')
    this.content.push('17')
    this.content.push('102')
    this.content.push('{ACAD_REACTORS')
    this.content.push('330')
    this.content.push('D')
    this.content.push('102')
    this.content.push('}')
    this.content.push('330')
    this.content.push('D')
    this.content.push('100')
    this.content.push('AcDbMlineStyle')
    this.content.push('2')
    this.content.push('STANDARD')
    this.content.push('70')
    this.content.push('0')
    this.content.push('3')
    this.content.push('')
    this.content.push('62')
    this.content.push('256')
    this.content.push('51')
    this.content.push('90.0')
    this.content.push('52')
    this.content.push('90.0')
    this.content.push('71')
    this.content.push('2')
    this.content.push('49')
    this.content.push('0.5')
    this.content.push('62')
    this.content.push('256')
    this.content.push('6')
    this.content.push('BYLAYER')
    this.content.push('49')
    this.content.push('-0.5')
    this.content.push('62')
    this.content.push('256')
    this.content.push('6')
    this.content.push('BYLAYER')
    this.content.push('0')
    this.content.push('ENDSEC')
    
    // End of file
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

// Find only the outermost boundary to avoid double lines
function findOuterBoundary(pixels: number[][], width: number, height: number): number[][] {
  // Find the bounding box of all black pixels
  let minX = width, maxX = -1, minY = height, maxY = -1
  let foundBlack = false
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (pixels[y][x] === 1) {
        foundBlack = true
        minX = Math.min(minX, x)
        maxX = Math.max(maxX, x)
        minY = Math.min(minY, y)
        maxY = Math.max(maxY, y)
      }
    }
  }
  
  if (!foundBlack) return []
  
  console.log(`Outer boundary: minX=${minX}, maxX=${maxX}, minY=${minY}, maxY=${maxY}`)
  
  // Create a simple rectangular boundary around the object
  const boundary: number[][] = []
  
  // Top edge (left to right)
  for (let x = minX; x <= maxX; x++) {
    boundary.push([x, minY])
  }
  
  // Right edge (top to bottom)
  for (let y = minY + 1; y <= maxY; y++) {
    boundary.push([maxX, y])
  }
  
  // Bottom edge (right to left)
  for (let x = maxX - 1; x >= minX; x--) {
    boundary.push([x, maxY])
  }
  
  // Left edge (bottom to top)
  for (let y = maxY - 1; y > minY; y--) {
    boundary.push([minX, y])
  }
  
  console.log(`Created outer boundary with ${boundary.length} points`)
  
  return boundary
}

// Find single outer boundary by tracing the actual edge of the shape
function findSingleOuterBoundary(pixels: number[][], width: number, height: number): number[][] {
  // Use the proven findPerfectContour function that works well
  return findPerfectContour(pixels, width, height)
}

// Thin boundaries to single-pixel width using Zhang-Suen thinning algorithm
function thinBoundaries(pixels: number[][], width: number, height: number): number[][] {
  const thinned = pixels.map(row => [...row]) // Deep copy
  let changed = true
  let iteration = 0
  const maxIterations = 50
  
  while (changed && iteration < maxIterations) {
    changed = false
    iteration++
    
    // Mark pixels for deletion in two passes
    const toDelete = new Set<string>()
    
    // Pass 1: Mark pixels for deletion
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        if (thinned[y][x] === 1) {
          const neighbors = getNeighbors(thinned, x, y, width, height)
          if (shouldDelete(neighbors, 1)) {
            toDelete.add(`${x},${y}`)
          }
        }
      }
    }
    
    // Delete marked pixels
    for (const coord of toDelete) {
      const [x, y] = coord.split(',').map(Number)
      thinned[y][x] = 0
      changed = true
    }
    
    // Pass 2: Mark pixels for deletion
    toDelete.clear()
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        if (thinned[y][x] === 1) {
          const neighbors = getNeighbors(thinned, x, y, width, height)
          if (shouldDelete(neighbors, 2)) {
            toDelete.add(`${x},${y}`)
          }
        }
      }
    }
    
    // Delete marked pixels
    for (const coord of toDelete) {
      const [x, y] = coord.split(',').map(Number)
      thinned[y][x] = 0
      changed = true
    }
  }
  
  console.log(`Thinning completed after ${iteration} iterations`)
  return thinned
}

// Get 8-connected neighbors
function getNeighbors(pixels: number[][], x: number, y: number, width: number, height: number): number[] {
  const neighbors = []
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue
      const nx = x + dx
      const ny = y + dy
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        neighbors.push(pixels[ny][nx])
      } else {
        neighbors.push(0) // Edge counts as background
      }
    }
  }
  return neighbors
}

// Check if pixel should be deleted in Zhang-Suen thinning
function shouldDelete(neighbors: number[], pass: number): boolean {
  // Count transitions from 0 to 1
  let transitions = 0
  for (let i = 0; i < 8; i++) {
    const current = neighbors[i]
    const next = neighbors[(i + 1) % 8]
    if (current === 0 && next === 1) {
      transitions++
    }
  }
  
  // Count black neighbors
  const blackNeighbors = neighbors.filter(n => n === 1).length
  
  if (pass === 1) {
    return transitions === 1 && 
           blackNeighbors >= 2 && 
           blackNeighbors <= 6 &&
           neighbors[0] * neighbors[2] * neighbors[4] === 0 &&
           neighbors[2] * neighbors[4] * neighbors[6] === 0
  } else {
    return transitions === 1 && 
           blackNeighbors >= 2 && 
           blackNeighbors <= 6 &&
           neighbors[0] * neighbors[2] * neighbors[6] === 0 &&
           neighbors[0] * neighbors[4] * neighbors[6] === 0
  }
}

// Find perfect contour using proper boundary detection - SINGLE LINE ONLY
function findPerfectContour(pixels: number[][], width: number, height: number): number[][] {
  // Use a more robust single-line boundary detection
  return findSingleLineBoundary(pixels, width, height)
}

// Find single line boundary that avoids multiple perimeter lines
function findSingleLineBoundary(pixels: number[][], width: number, height: number): number[][] {
  // First, find the bounding box of the shape
  let minX = width, maxX = -1, minY = height, maxY = -1
  let foundBlack = false
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (pixels[y][x] === 1) {
        foundBlack = true
        minX = Math.min(minX, x)
        maxX = Math.max(maxX, x)
        minY = Math.min(minY, y)
        maxY = Math.max(maxY, y)
      }
    }
  }
  
  if (!foundBlack) return []
  
  console.log(`Shape bounds: minX=${minX}, maxX=${maxX}, minY=${minY}, maxY=${maxY}`)
  
  // Find the outermost boundary by scanning from the outside in
  const boundary: number[][] = []
  const visited = new Set<string>()
  
  // Start from the top-left corner of the bounding box
  let startX = minX
  let startY = minY
  
  // Find the actual edge of the shape (not just the bounding box)
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (pixels[y][x] === 1) {
        startX = x
        startY = y
        break
      }
    }
    if (pixels[startY][startX] === 1) break
  }
  
  // Use Moore neighborhood tracing to follow the outer boundary
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
  
  boundary.push([currentX, currentY])
  visited.add(`${currentX},${currentY}`)
  
  let iterations = 0
  const maxIterations = (maxX - minX + maxY - minY) * 4 // Reasonable limit
  
  while (iterations < maxIterations) {
    let found = false
    let nextX = -1, nextY = -1, nextDirection = -1
    
    // Look for the next boundary pixel using Moore neighborhood
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
    
    if (!found) {
      // If we can't find an unvisited neighbor, try to find any boundary pixel
      for (let i = 0; i < 8; i++) {
        const dirIndex = (direction + i) % 8
        const [dx, dy] = directions[dirIndex]
        const testX = currentX + dx
        const testY = currentY + dy
        
        if (testX >= 0 && testX < width && testY >= 0 && testY < height) {
          if (pixels[testY][testX] === 1) {
            nextX = testX
            nextY = testY
            nextDirection = (dirIndex + 6) % 8
            found = true
            break
          }
        }
      }
    }
    
    if (!found) break
    
    // Check if we've completed the loop
    if (nextX === startX && nextY === startY && boundary.length > 3) {
      break
    }
    
    // Add the next point
    boundary.push([nextX, nextY])
    visited.add(`${nextX},${nextY}`)
    
    currentX = nextX
    currentY = nextY
    direction = nextDirection
    iterations++
  }
  
  console.log(`Single line boundary found with ${boundary.length} points`)
  return boundary
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
  
    boundary.push([currentX, currentY])
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
    boundary.push([nextX, nextY])
    visited.add(`${nextX},${nextY}`)
    
    currentX = nextX
    currentY = nextY
    direction = nextDirection
    iterations++
  }
  
  return boundary
}

// Trace a single clean boundary line using improved algorithm
function traceSingleBoundary(pixels: number[][], width: number, height: number, startX?: number, startY?: number): number[][] {
  // Find the first black pixel to start if not provided
  if (startX === undefined || startY === undefined) {
    for (let y = 0; y < height && startX === undefined; y++) {
      for (let x = 0; x < width && startX === undefined; x++) {
        if (pixels[y][x] === 1) {
          startX = x
          startY = y
        }
      }
    }
  }
  
  if (startX === undefined || startY === undefined) return []
  
  // Use the more robust boundary tracing algorithm
  return findPerfectContour(pixels, width, height)
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
  
  // Scale up coordinates to make them more visible in DXF readers
  // Multiply by 100 to convert from inches to hundredths of an inch (common DXF unit)
  const scaledUpContour = scaledContour.map(([x, y]) => [
    x * 100,
    y * 100
  ])
  
  console.log(`  Scaled up coordinates (first 3):`, scaledUpContour.slice(0, 3))
  
  // Normalize coordinates to ensure they're in the positive quadrant
  // Find the minimum Y coordinate and shift everything up
  let minY = Infinity
  for (const [x, y] of scaledUpContour) {
    minY = Math.min(minY, y)
  }
  
  // If we have negative Y coordinates, shift everything up
  if (minY < 0) {
    const offsetY = Math.abs(minY) + 10 // Add small margin (scaled up)
    for (let i = 0; i < scaledUpContour.length; i++) {
      scaledUpContour[i][1] += offsetY
    }
    console.log(`  Shifted Y coordinates up by ${offsetY} to ensure positive values`)
  }
  
  console.log(`  Sample scaled points (first 3):`, scaledUpContour.slice(0, 3))
  console.log(`  Sample scaled points (last 3):`, scaledUpContour.slice(-3))
  
  // Calculate final dimensions for verification
  let finalMinX = Infinity, finalMaxX = -Infinity, finalMinY = Infinity, finalMaxY = -Infinity
  for (const [x, y] of scaledUpContour) {
    finalMinX = Math.min(finalMinX, x)
    finalMaxX = Math.max(finalMaxX, x)
    finalMinY = Math.min(finalMinY, y)
    finalMaxY = Math.max(finalMaxY, y)
  }
  const finalWidthInches = (finalMaxX - finalMinX) / 100 // Convert back to inches for display
  const finalHeightInches = (finalMaxY - finalMinY) / 100 // Convert back to inches for display
  console.log(`  Final width: ${finalWidthInches} inches`)
  console.log(`  Final height: ${finalHeightInches} inches`)
  
  return scaledUpContour
}

// Straighten lines that are very close to 0° or 90° (within 0.03 radians)
function straightenNearOrthogonalLines(contour: number[][]): number[][] {
  if (contour.length < 2) return contour
  
  const straightened: number[][] = []
  const tolerance = 0.05 // 0.05 radians ≈ 2.87 degrees
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

// Apply morphological cleanup to image data buffer
function applyMorphologicalCleanup(imageData: Buffer, width: number, height: number): Buffer {
  // Convert buffer to 2D array
  const pixels: number[][] = []
  for (let y = 0; y < height; y++) {
    pixels[y] = []
    for (let x = 0; x < width; x++) {
      const idx = y * width + x
      pixels[y][x] = imageData[idx] < 128 ? 1 : 0
    }
  }
  
  // Apply opening (erosion followed by dilation) to remove noise
  const opened = applyMorphology(pixels, width, height)
  
  // Apply closing (dilation followed by erosion) to fill small gaps
  const closed = applyMorphology(opened, width, height)
  
  // Convert back to buffer
  const result = Buffer.alloc(imageData.length)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x
      result[idx] = closed[y][x] === 1 ? 0 : 255
    }
  }
  
  console.log(`Applied morphological cleanup to ${width}x${height} image`)
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
    contour.push([x, y]) // DXF coordinate system
    
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
    contour.push([x, y])
    
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
    contour.push([x, y]) // DXF coordinate system
    
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
      
      // Smart line segment reduction that preserves shape
      const cleanedPath = removeDuplicatePoints(boundary, 0.01) // Light duplicate removal
      
      // Adaptive point reduction - keeps important curve points, removes redundant ones
      const reducedPath = adaptivePointReduction(cleanedPath, simplify)
      
      // Merge straight line segments - eliminates multiple segments on straight runs
      const mergedStraightLines = mergeStraightLineSegments(reducedPath, 0.02)
      
      // Optional straightening (can be disabled if causing issues)
      const straightenedPath = straightenNearOrthogonalLines(mergedStraightLines)
      
      // Final cleanup
      const finalPath = removeDuplicatePoints(straightenedPath, 0.005)
      
      console.log(`Line segment reduction: ${boundary.length} → ${finalPath.length} points (${Math.round((1 - finalPath.length / boundary.length) * 100)}% reduction)`)
      
      // Scale the path to the desired dimension
      const scaledPath = scaleContour(finalPath, dimensionControl === 'width' ? width : height, dimensionControl === 'width' ? imageWidth : imageHeight, dimensionControl)
      
      // Create as a single polyline
      writer.addPolyline(scaledPath, {
        layer: '0',
        closed: true
      })
    }

    const dxfContent = writer.toString()
    
    // Validate DXF content
    console.log(`Generated DXF content length: ${dxfContent.length} characters`)
    console.log(`DXF starts with: ${dxfContent.substring(0, 100)}`)
    console.log(`DXF ends with: ${dxfContent.substring(dxfContent.length - 100)}`)
    
    return dxfContent
  } catch (error) {
    console.error('Conversion error:', error)
    throw new Error(`Conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// Aggressive but safe point reduction - targets under 200 segments
function adaptivePointReduction(contour: number[][], reductionFactor: number): number[][] {
  if (contour.length <= 3) return contour
  
  // Target maximum 200 points, but respect the simplify setting for minimum
  const maxPoints = 200
  const minPoints = Math.max(50, Math.floor(contour.length * 0.1)) // At least 10% of original
  const targetPoints = Math.min(maxPoints, Math.max(minPoints, Math.floor(contour.length * (1 - reductionFactor))))
  
  if (targetPoints >= contour.length) return contour
  
  const result: number[][] = []
  const step = contour.length / targetPoints
  
  // Always keep first point
  result.push([...contour[0]])
  
  for (let i = 1; i < targetPoints - 1; i++) {
    const index = Math.floor(i * step)
    if (index > 0 && index < contour.length - 1) {
      result.push([...contour[index]])
    }
  }
  
  // Always keep last point
  result.push([...contour[contour.length - 1]])
  
  return result
}

// Merge nearly straight line segments to reduce total line count
function mergeStraightLineSegments(contour: number[][], angleTolerance: number): number[][] {
  if (contour.length <= 2) return contour
  
  const result: number[][] = []
  let i = 0
  
  while (i < contour.length) {
    const startPoint = contour[i]
    result.push([...startPoint])
    
    // Look ahead to find consecutive points that form a nearly straight line
    let j = i + 1
    let lastGoodPoint = i
    
    while (j < contour.length) {
      const currentPoint = contour[j]
      const nextPoint = contour[(j + 1) % contour.length]
      
      // Calculate the angle of the line from start to current point
      const lineAngle = Math.atan2(currentPoint[1] - startPoint[1], currentPoint[0] - startPoint[0])
      
      // Calculate the angle of the next segment
      const nextAngle = Math.atan2(nextPoint[1] - currentPoint[1], nextPoint[0] - currentPoint[0])
      
      // Check if the angle change is within tolerance (nearly straight)
      let angleDiff = Math.abs(lineAngle - nextAngle)
      angleDiff = Math.min(angleDiff, Math.abs(angleDiff - Math.PI * 2))
      
      if (angleDiff > angleTolerance) {
        break // Stop merging when we hit a significant angle change
      }
      
      lastGoodPoint = j
      j++
    }
    
    // Move to the last merged point, but ensure we make progress
    i = Math.max(lastGoodPoint + 1, i + 1)
  }
  
  return result
}

// Smart simplification that preserves both straight lines and curves
function simplifyContour(contour: number[][], tolerance: number): number[][] {
  if (contour.length <= 2) return contour
  
  // Use conservative tolerance to preserve shape
  const scaledTolerance = Math.max(tolerance * 0.3, 0.05) // Conservative simplification
  
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
    const width = parseFloat(formData.get('width') as string) || 1.0
    const height = parseFloat(formData.get('height') as string) || 1.0
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
