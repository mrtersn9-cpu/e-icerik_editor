import {
  AudioLines,
  FileImage,
  Image,
  MapPin,
  MousePointerClick,
  Shapes,
  Type,
  Video,
} from 'lucide-react';

/**
 * Tek "nesne ekle" kaynağı — mobil (MobileToolbar) ve masaüstü (EditorToolRail)
 * aynı listeyi tüketir; böylece iki yüzey arasında drift olmaz. Saf konfigürasyon;
 * motor mantığı içermez, yalnız StageCanvas imperative API'sini tetikler.
 */
export const CANVAS_ADD_ACTIONS = [
  { id: 'text', label: 'Metin', icon: Type, run: (ref) => ref?.current?.addObject?.('text') },
  { id: 'button', label: 'Buton', icon: MousePointerClick, run: (ref) => ref?.current?.addObject?.('button') },
  { id: 'shape', label: 'Şekil', icon: Shapes, run: (ref) => ref?.current?.addObject?.('shape') },
  { id: 'hotspot', label: 'Hotspot', icon: MapPin, run: (ref) => ref?.current?.addObject?.('hotspot') },
  { id: 'image', label: 'Resim', icon: Image, run: (ref) => ref?.current?.addImage?.() },
  { id: 'video', label: 'Video', icon: Video, run: (ref) => ref?.current?.addVideo?.() },
  { id: 'audio', label: 'Ses', icon: AudioLines, run: (ref) => ref?.current?.addAudio?.() },
  { id: 'svg', label: 'Zemin', icon: FileImage, run: (ref) => ref?.current?.loadSVG?.() },
];
