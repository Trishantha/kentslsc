export interface CardDetails {
  membershipId: string;
  memberName: string;
  membershipTypeName: string;
  isFree: boolean;
  startDate: Date;
  endDate: Date;
  dependantsCount: number;
  qrValue: string;
}

export async function generateCardBuffer(_details: CardDetails): Promise<Buffer> {
  return Buffer.from('mock-card');
}
