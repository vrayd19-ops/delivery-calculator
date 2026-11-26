import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { classifyInvoiceText } from '@/lib/transport-request/invoiceClassifier';
import { POST as createRequest } from '@/app/api/transport-request/route';
import { POST as finalize } from '@/app/api/transport-request/finalize/route';
import { POST as upload } from '@/app/api/transport-request/invoice/route';
import { POST as validate } from '@/app/api/transport-request/invoice/validate/route';
import type { InvoiceKind } from '@/lib/transport-request/invoiceParties';

// Exercise the upload and validation handlers without contacting Telegram or a production database.
vi.mock('pdf-parse/worker', () => ({ CanvasFactory: class {} }));
vi.mock('pdf-parse', () => ({
  PDFParse: class {
    constructor(private input: { data: Buffer }) {}
    async getText() { return { text: this.input.data.toString('utf8') }; }
    async destroy() {}
  },
}));
vi.mock('@/lib/auth', () => ({ getCurrentUser: async () => ({ id: 'manager', role: 'MANAGER' }) }));
vi.mock('@/lib/telegram/transportRequestInvoiceTelegram', () => ({
  sendTransportRequestInvoiceDocumentToTelegram: async () => ({ messageId: 'test' }),
}));
vi.mock('@/lib/transport-request/invoiceStorage', () => ({
  saveTransportRequestInvoiceFile: async () => {}, readTransportRequestInvoiceFile: async () => Buffer.from('Итого 100'),
}));
vi.mock('@/lib/telegram/transportRequestTelegram', () => ({ sendTransportRequestTextToTelegram: async () => ({messageId:'test'}) }));
vi.mock('@/lib/integrations/punkt', () => ({
  syncTransportRequestToPunkt: async () => ({action:'created'}), syncTransportRequestDocumentToPunkt: async () => ({}),
}));
vi.mock('@/lib/integrations/punkt-loading-items', () => ({ syncTransportRequestLoadingItemsToPunkt: async () => ({}) }));
type Row = { id: string; transportRequestId: string; kind: InvoiceKind; ourCompanyInn: string; ourCompanyName: string; telegramSent: boolean };
const rows = vi.hoisted(() => [] as Row[]);
vi.mock('@/lib/db', () => ({ prisma: {
  transportRequestCounter: { upsert: async () => ({value:1}) },
  transportRequest: {
    create: async ({data}: {data:object}) => ({ ...data, id:'one-request',createdAt:new Date() }),
    findUnique: async () => ({ id: 'one-request', requestNumber:'test-1', createdAt:new Date(), loadingDate:new Date(), createdByUserId: 'manager', telegramSent: false, invoices:rows }),
    update: async () => ({}),
  },
  transportRequestInvoice: {
    findMany: async () => rows,
    findFirst: async () => null,
    count: async ({where}: {where: Partial<Row>}) => rows.filter(row =>
      Object.entries(where).every(([key,value]) => row[key as keyof Row] === value)).length,
    create: async ({data}: {data: Row}) => { const row = {...data, id: String(rows.length + 1)}; rows.push(row); return row; },
    update: async ({where,data}: {where: {id:string}; data: Partial<Row>}) => Object.assign(rows.find(row => row.id === where.id)!, data),
  },
}}));
const ggs = 'ООО ГГС, ИНН 9204569514';
const lst = 'ООО ЛСТ, ИНН 9718232572';
const customer = 'ООО РОМАШКА, ИНН 7707083893';
const supplier = 'ООО ТЮЛЬПАН, ИНН 7704217370';
const invoice = (seller: string, buyer: string) => [
  'Счёт на оплату № 517 от 25.11.2026', 'Продавец: ' + seller,
  'Покупатель: ' + buyer, 'Итого к оплате: 1250,50',
].join('\n');
const classify = (a:string,b:string,k:InvoiceKind,manual?:InvoiceKind) => classifyInvoiceText(invoice(a,b),k,'PDF_TEXT',manual);
async function post(seller:string,buyer:string,kind:InvoiceKind,manual?:InvoiceKind) {
  const form = new FormData();
  form.set('file',new File([invoice(seller,buyer)], 'invoice-'+rows.length+'.pdf', {type:'application/pdf'}));
  form.set('transportRequestId','one-request'); form.set('kind',kind);
  if(manual) form.set('internalKind',manual);
  const request = () => new NextRequest('http://localhost/api/transport-request/invoice', {method:'POST',body:form});
  const validation = await validate(request());
  const uploadResult = await upload(request());
  expect(uploadResult.status).toBe(validation.ok ? 201 : validation.status);
  return {status:uploadResult.status, body:await uploadResult.json()};
}
beforeEach(() => { rows.length=0; });
describe('transport request invoice parties', () => {
  it.each([
    [ggs,customer,'OUR','ООО ГГС'], [lst,customer,'OUR','ООО ЛСТ'],
    [supplier,ggs,'SUPPLIER','ООО ГГС'], [supplier,lst,'SUPPLIER','ООО ЛСТ'],
  ] as const)('classifies %s → %s', (a,b,k,name) => {
    expect(classify(a,b,k)).toMatchObject({accepted:true, detectedKind:k, ourCompanyName:name,
      invoiceNumber:'517', invoiceDate:'2026-11-25',invoiceAmount:'1250.50'});
  });
  it.each([[ggs,lst],[lst,ggs],[ggs,ggs],[lst,lst]])('accepts one request with sale by %s and purchase by %s',async(a,b)=>{
    expect((await post(a,customer,'OUR')).status).toBe(201);
    expect((await post(supplier,b,'SUPPLIER')).body.requirementsSatisfied).toBe(true);
    expect(rows.map(r=>r.ourCompanyInn)).toEqual([a.slice(-10),b.slice(-10)]);
  });
  it('accepts two sales and two purchases from different group companies on one request',async()=>{
    const form = new FormData();
    const date = new Date(Date.now()+86400000).toISOString().slice(0,10);
    for(const [k,v] of Object.entries({
      managerEmail:'manager@example.test', customer:'Клиент', loadingDate:date, totalWeight:'3', cargoLength:'2',
      needsStakes:'no',loadingAddress:'Казань',loadingContactName:'Менеджер',loadingContactPhone:'+79990000000',
      loadingUntil:'18:00',unloadingAddress:'Москва',unloadingContactName:'Получатель',unloadingContactPhone:'+79990000001',unloadingUntil:'21:00',
    })) form.set(k,v);
    const created = await createRequest(new NextRequest('http://localhost/api/transport-request',{method:'POST',body:form}));
    const createdBody = await created.json();
    expect(createdBody, JSON.stringify(createdBody)).toMatchObject({success:true,requestId:'one-request'});
    for(const a of [ggs,lst]) expect((await post(a,customer,'OUR')).status).toBe(201);
    for(const b of [lst,ggs]) expect((await post(supplier,b,'SUPPLIER')).status).toBe(201);
    expect(rows.map(r=>[r.transportRequestId,r.kind,r.ourCompanyName])).toEqual([
      ['one-request','OUR','ООО ГГС'],['one-request','OUR','ООО ЛСТ'],
      ['one-request','SUPPLIER','ООО ЛСТ'],['one-request','SUPPLIER','ООО ГГС'],
    ]);
    const completed = await finalize(new NextRequest('http://localhost/api/transport-request/finalize',{method:'POST',
      body:JSON.stringify({transportRequestId:createdBody.requestId,ourExpectedCount:2,supplierExpectedCount:2})}));
    expect(await completed.json()).toMatchObject({success:true,ourInvoiceCount:2,supplierInvoiceCount:2,punktSync:{success:true}});

  });
  it.each([[ggs,lst],[lst,ggs]])('requires an explicit choice for %s → %s',async(a,b)=>{
    for(const k of ['OUR','SUPPLIER'] as const){
      expect(classify(a,b,k)).toMatchObject({accepted:false,detectedKind:'INTERNAL'});
      expect((await post(a,b,k)).status).toBe(422);
      expect((await post(a,b,k,k)).status).toBe(201);
      expect(rows.at(-1)?.ourCompanyInn).toBe((k==='OUR'?a:b).slice(-10));
    }
  });
  it('rejects unknown parties even with a manual choice',()=>{
    expect(classify(supplier,customer,'OUR','OUR')).toMatchObject({accepted:false,detectedKind:'UNKNOWN'});
  });
  it.each([
    ['ОШИБКА OCR, ИНН 9718232572',customer,'OUR','9718232572'],
    [supplier,'ОШИБКА OCR, ИНН 9204569514','SUPPLIER','9204569514'],
  ] as const)('uses the recognized INN for %s → %s',(a,b,k,inn)=>{
    expect(classify(a,b,k)).toMatchObject({accepted:true,ourCompanyInn:inn});
  });
  it.each(['ООО ГГС','ООО "ГГС"','ООО ГЛАВГЕНСТРОЙ','ГЛАВГЕНСТРОЙ ООО','ООО ЛСТ','ООО «ЛСТ»','ООО ЛИСТ СТАЛИ','ЛИСТ СТАЛИ ООО'])('accepts name alias %s',a=>{
    expect(classify(a,customer,'OUR').accepted).toBe(true);
  });
  it('prefers the invoice buyer over a payer in the bank header', () => {
    const text = 'Плательщик: ООО ГГС, ИНН 9204569514\n' + invoice(supplier, lst);
    expect(classifyInvoiceText(text, 'SUPPLIER', 'PDF_TEXT')).toMatchObject({accepted:true,ourCompanyInn:'9718232572'});
  });
  it('recognizes payer as the buyer when no buyer label exists', () => {
    const text = invoice(supplier, 'ООО «ЛСТ»').replace('Покупатель:', 'Плательщик:');
    expect(classifyInvoiceText(text, 'SUPPLIER', 'OCR')).toMatchObject({accepted:true,ourCompanyInn:'9718232572'});
  });
  it('gives an external INN priority over an internal name',()=>{
    expect(classify('ООО ЛСТ, ИНН/КПП 7707083893/770701001',customer,'OUR').detectedKind).toBe('UNKNOWN');
    expect(classify('ООО ЛСТ-СНАБ',customer,'OUR').detectedKind).toBe('UNKNOWN');
  });
  it('explains the correct block and refuses a forced override for an external invoice',()=>{
    expect(classify(supplier,lst,'OUR','OUR')).toMatchObject({accepted:false,detectedKind:'SUPPLIER',message:expect.stringContaining('Покупатель: ООО ЛСТ')});
    expect(classify(ggs,customer,'SUPPLIER','SUPPLIER')).toMatchObject({accepted:false,detectedKind:'OUR',message:expect.stringContaining('Продавец: ООО ГГС')});
  });
});
