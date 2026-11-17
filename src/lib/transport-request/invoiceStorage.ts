import {
  mkdir,
  readFile,
  writeFile,
} from 'node:fs/promises';

import path from 'node:path';


function storageDirectory(): string {
  return path.join(
    process.cwd(),
    'storage',
    'transport-request-invoices'
  );
}


export function getTransportRequestInvoiceStoragePath(
  invoiceId: string
): string {
  return path.join(
    storageDirectory(),
    `${invoiceId}.bin`
  );
}


export async function saveTransportRequestInvoiceFile(
  invoiceId: string,
  file: File
): Promise<void> {
  const directory =
    storageDirectory();

  await mkdir(
    directory,
    {
      recursive: true,
    }
  );

  const bytes =
    Buffer.from(
      await file.arrayBuffer()
    );

  await writeFile(
    getTransportRequestInvoiceStoragePath(
      invoiceId
    ),
    bytes
  );
}


export async function readTransportRequestInvoiceFile(
  invoiceId: string
): Promise<Buffer> {
  return readFile(
    getTransportRequestInvoiceStoragePath(
      invoiceId
    )
  );
}