import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../core/prisma/prisma.service.js';
import { PolicyDocumentType } from '@kentslsc/shared';

@Injectable()
export class PolicyDocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  async listPublished() {
    return this.prisma.policyDocument.findMany({
      where: { isPublished: true },
      select: { id: true, type: true, title: true, updatedAt: true },
      orderBy: { type: 'asc' }
    });
  }

  async findByType(type: PolicyDocumentType) {
    const doc = await this.prisma.policyDocument.findUnique({ where: { type } });
    if (!doc || !doc.isPublished) throw new NotFoundException('Policy document not found');
    return doc;
  }

  async listAdmin() {
    return this.prisma.policyDocument.findMany({
      orderBy: { type: 'asc' }
    });
  }

  async findAdminByType(type: PolicyDocumentType) {
    const doc = await this.prisma.policyDocument.findUnique({ where: { type } });
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
}
