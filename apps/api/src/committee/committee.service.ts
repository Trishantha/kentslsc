import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { PrismaService } from '../core/prisma/prisma.service.js';
import { SupabaseStorageService } from '../core/supabase/supabase.service.js';
import type { CreateCommitteeMemberDto, UpdateCommitteeMemberDto } from './dto/index.js';

@Injectable()
export class CommitteeService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(SupabaseStorageService)
    private readonly supabaseStorage: SupabaseStorageService
  ) {}

  private extractStoragePath(url: string): string | null {
    const bucket = process.env.SUPABASE_BUCKET ?? 'KentSLSC';
    const marker = `/storage/v1/object/public/${bucket}/`;
    const index = url.indexOf(marker);
    if (index === -1) return null;
    return url.slice(index + marker.length);
  }

  private async deletePhotoIfExists(url: string | null | undefined) {
    if (!url || !this.supabaseStorage.isConfigured) return;
    const path = this.extractStoragePath(url);
    if (!path) return;
    try {
      await this.supabaseStorage.delete(path);
    } catch {
      // Ignore cleanup failures so member operations still succeed.
    }
  }

  async findAll() {
    return this.prisma.committeeMember.findMany({
      where: { deletedAt: null },
      orderBy: { displayOrder: 'asc' },
      select: {
        id: true,
        name: true,
        position: true,
        roleKey: true,
        photoUrl: true,
        displayOrder: true,
        createdAt: true,
        updatedAt: true
      }
    });
  }

  async findById(id: string) {
    const member = await this.prisma.committeeMember.findFirst({
      where: { id, deletedAt: null }
    });
    if (!member) throw new NotFoundException('Committee member not found');
    return member;
  }

  async create(dto: CreateCommitteeMemberDto) {
    return this.prisma.committeeMember.create({
      data: {
        name: dto.name,
        position: dto.position,
        roleKey: dto.roleKey,
        photoUrl: dto.photoUrl,
        photoPath: dto.photoUrl ? this.extractStoragePath(dto.photoUrl) : null,
        displayOrder: dto.displayOrder ?? 0
      }
    });
  }

  async update(id: string, dto: UpdateCommitteeMemberDto) {
    const existing = await this.findById(id);
    const oldPhotoUrl = dto.photoUrl !== undefined ? existing.photoUrl : null;

    const updated = await this.prisma.committeeMember.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.position !== undefined && { position: dto.position }),
        ...(dto.roleKey !== undefined && { roleKey: dto.roleKey }),
        ...(dto.photoUrl !== undefined && {
          photoUrl: dto.photoUrl || null,
          photoPath: dto.photoUrl ? this.extractStoragePath(dto.photoUrl) : null
        }),
        ...(dto.displayOrder !== undefined && { displayOrder: dto.displayOrder })
      }
    });

    if (oldPhotoUrl && oldPhotoUrl !== dto.photoUrl) {
      await this.deletePhotoIfExists(oldPhotoUrl);
    }

    return updated;
  }

  async remove(id: string) {
    const existing = await this.findById(id);
    await this.prisma.committeeMember.update({
      where: { id },
      data: { deletedAt: new Date() }
    });
    await this.deletePhotoIfExists(existing.photoUrl);
    return { id, deleted: true };
  }
}
