import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../core/prisma/prisma.service.js';
import { SupabaseStorageService } from '../core/supabase/supabase.service.js';
import { PolicyDocumentType } from '@kentslsc/shared';

const filesOrderBy = [{ displayOrder: 'asc' as const }, { createdAt: 'asc' as const }];

@Injectable()
export class PolicyDocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly supabaseStorage: SupabaseStorageService
  ) {}

  async listPublished() {
    return this.prisma.policyDocument.findMany({
      where: { isPublished: true },
      select: { id: true, type: true, title: true, updatedAt: true },
      orderBy: { type: 'asc' }
    });
  }

  async findByType(type: PolicyDocumentType) {
    const doc = await this.prisma.policyDocument.findUnique({
      where: { type },
      include: { files: { orderBy: filesOrderBy } }
    });
    if (!doc || !doc.isPublished) throw new NotFoundException('Policy document not found');
    return doc;
  }

  async listAdmin() {
    return this.prisma.policyDocument.findMany({
      orderBy: { type: 'asc' }
    });
  }

  async findAdminByType(type: PolicyDocumentType) {
    const doc = await this.prisma.policyDocument.findUnique({
      where: { type },
      include: { files: { orderBy: filesOrderBy } }
    });
    if (!doc) throw new NotFoundException('Policy document not found');
    return doc;
  }

  async upsert(type: PolicyDocumentType, data: { title: string; content: string; isPublished?: boolean }, updatedBy?: string) {
    return this.prisma.policyDocument.upsert({
      where: { type },
      update: {
        title: data.title,
        content: data.content,
        ...(data.isPublished !== undefined && { isPublished: data.isPublished }),
        ...(updatedBy && { updatedBy })
      },
      create: {
        type,
        title: data.title,
        content: data.content,
        isPublished: data.isPublished ?? false,
        ...(updatedBy && { updatedBy })
      }
    });
  }

  async addFile(
    type: PolicyDocumentType,
    data: { name: string; fileUrl: string; filePath: string; fileSize?: number },
    uploadedBy?: string
  ) {
    const doc = await this.prisma.policyDocument.findUnique({ where: { type } });
    if (!doc) throw new NotFoundException('Policy document not found');

    const count = await this.prisma.policyDocumentFile.count({
      where: { policyDocumentId: doc.id }
    });

    return this.prisma.policyDocumentFile.create({
      data: {
        policyDocumentId: doc.id,
        name: data.name,
        fileUrl: data.fileUrl,
        filePath: data.filePath,
        fileSize: data.fileSize ?? null,
        displayOrder: count,
        ...(uploadedBy && { uploadedBy })
      }
    });
  }

  async removeFile(fileId: string) {
    const file = await this.prisma.policyDocumentFile.findUnique({ where: { id: fileId } });
    if (!file) throw new NotFoundException('Attached file not found');

    await this.prisma.policyDocumentFile.delete({ where: { id: fileId } });

    if (this.supabaseStorage.isConfigured) {
      await this.supabaseStorage.delete(file.filePath).catch(() => undefined);
    }

    return { id: fileId, removed: true };
  }
}
