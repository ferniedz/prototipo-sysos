import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { size?: number }
const paths: Record<string, string> = {
  ArrowDown: 'M12 4v16m-6-6 6 6 6-6',
  ArrowLeft: 'M20 12H4m6-6-6 6 6 6',
  ArrowRight: 'M4 12h16m-6-6 6 6-6 6',
  ArrowUpRight: 'M6 18 18 6M6 6h12v12',
  Check: 'm5 12 4 4L19 6',
  ChevronLeft: 'm15 5-7 7 7 7',
  ChevronRight: 'm9 5 7 7-7 7',
  CircleHelp: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20M9 9a3 3 0 0 1 6 0c0 2-3 2-3 4m0 3v.01',
  ClipboardList: 'M9 4H5v17h14V4h-4M9 2h6v5H9zm0 9h6m-6 4h6',
  Database: 'M21 5c0 2-4 3-9 3S3 7 3 5s4-3 9-3 9 1 9 3Zm0 0v14c0 2-4 3-9 3s-9-1-9-3V5m0 7c0 2 4 3 9 3s9-1 9-3',
  Fingerprint: 'M4 10a8 8 0 0 1 16 0v5M8 21c3-3 0-10 4-10 3 0 0 7 4 10M4 14v3m16 2v2M8 11a4 4 0 0 1 8 0v5M12 3V2M12 15v4',
  HardDrive: 'm3 15 3-12h12l3 12M3 15h18v6H3zm13 3h.01m3 0h.01',
  Layers2: 'm12 3 10 6-10 6L2 9Zm-10 12 10 6 10-6M2 12l10 6 10-6',
  Mail: 'M3 5h18v14H3Zm0 0 9 8 9-8',
  Monitor: 'M3 3h18v14H3zm5 18h8m-4-4v4',
  Plus: 'M12 5v14M5 12h14',
  Search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14m5-2 5 5',
  ShieldCheck: 'm12 2 9 4v6c0 5-9 10-9 10S3 17 3 12V6Zm-5 10 3 3 7-7',
  SlidersHorizontal: 'M3 6h5m4 0h9M3 18h9m4 0h5M8 3v6m4 6v6',
  Sparkles: 'm12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3Zm7 0v4m-2-2h4',
  UserRound: 'M16 7a4 4 0 1 0-8 0 4 4 0 0 0 8 0M4 22v-3a8 8 0 0 1 16 0v3',
  UsersRound: 'M14 7a4 4 0 1 0-8 0 4 4 0 0 0 8 0M2 21v-2a8 8 0 0 1 16 0v2m0-17a4 4 0 0 1 0 8m3 9v-2a8 8 0 0 0-2-6',
  X: 'm6 6 12 12M6 18 18 6',
  Zap: 'm13 2-9 12h7l-1 8 10-13h-8z',
  Info: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20m0-12v7m0-10v.01',
  AlertTriangle: 'm12 2 10 19H2Zm0 6v6m0 3v.01',
}
function icon(name: string) {
  return function Icon({ size = 24, strokeWidth = 1.7, ...props }: IconProps) {
    return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><path d={paths[name]} /></svg>
  }
}
export const ArrowDown = icon('ArrowDown')
export const ArrowLeft = icon('ArrowLeft')
export const ArrowRight = icon('ArrowRight')
export const ArrowUpRight = icon('ArrowUpRight')
export const Check = icon('Check')
export const ChevronLeft = icon('ChevronLeft')
export const ChevronRight = icon('ChevronRight')
export const CircleHelp = icon('CircleHelp')
export const ClipboardList = icon('ClipboardList')
export const Database = icon('Database')
export const Fingerprint = icon('Fingerprint')
export const HardDrive = icon('HardDrive')
export const Layers2 = icon('Layers2')
export const Mail = icon('Mail')
export const Monitor = icon('Monitor')
export const Plus = icon('Plus')
export const Search = icon('Search')
export const ShieldCheck = icon('ShieldCheck')
export const SlidersHorizontal = icon('SlidersHorizontal')
export const Sparkles = icon('Sparkles')
export const UserRound = icon('UserRound')
export const UsersRound = icon('UsersRound')
export const X = icon('X')
export const Zap = icon('Zap')
export const Info = icon('Info')
export const AlertTriangle = icon('AlertTriangle')
