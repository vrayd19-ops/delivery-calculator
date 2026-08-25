import { NextResponse } from 'next/server';
import { suggestAddress } from '@/lib/yandex';

export async function GET(req:Request){
  try{
    const q=new URL(req.url).searchParams.get('q')?.trim();

    if(!q || q.length < 3)
      return NextResponse.json([]);

    return NextResponse.json(await suggestAddress(q));

  }catch(e:any){
    return NextResponse.json(
      {error:e.message},
      {status:502}
    );
  }
}