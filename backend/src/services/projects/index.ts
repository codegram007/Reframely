/** Project/import ownership checks backed by the import metadata repository. */
import { AuthError } from '../auth/index.js';
import type { ImportRepository } from '../storage/import-repository.js';

export class ProjectAccessService {
  constructor(private readonly repository: ImportRepository) {}

  async assertImportOwner(importId: string, userId: string): Promise<void> {
    const record = await this.repository.findById(importId);
    if (!record || record.ownerId !== userId) {
      throw new AuthError('FORBIDDEN', 'You do not have access to this import.');
    }
  }

  async assertProjectOwner(projectId: string, userId: string): Promise<void> {
    const record = await this.repository.findByProjectId(projectId);
    if (!record || record.ownerId !== userId) {
      throw new AuthError('FORBIDDEN', 'You do not have access to this project.');
    }
  }
}
