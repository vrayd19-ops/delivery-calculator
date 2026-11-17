import type { Metadata } from 'next';
import TransportLoadingViewer from '@/components/TransportLoadingViewer';

export const metadata: Metadata = {
  title: '3D-проверка погрузки — МАЗ',
  description: 'Локальная проверка 3D-модели МАЗа с полуприцепом, открывающимися бортами и съёмными кониками.',
};

export default function TransportLoadingPage() {
  return <TransportLoadingViewer />;
}
