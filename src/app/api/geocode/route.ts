import { NextResponse } from 'next/server';
import { geocodeAddress } from '@/lib/yandex';

export async function POST(req: Request) {
  try {
    const body = await req.json();

    console.log('GEOCODE INPUT:', {
      text: body.text,
      hasUri: Boolean(body.uri),
    });

    const result = await geocodeAddress({
      text: body.text,
      uri: body.uri,
    });

    console.log(
      'GEOCODE SUCCESS:',
      result.length,
      'результатов'
    );

    return NextResponse.json(result);
  } catch (error: any) {
    console.error(
      'GEOCODE ERROR:',
      error?.message || error
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          'Ошибка геокодирования',
      },
      {
        status: 502,
      }
    );
  }
}