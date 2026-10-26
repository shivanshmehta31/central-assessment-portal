import { Controller, Get, Param, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { FilesService } from './files.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'FACULTY')
@Controller('files')
export class FilesController {
  constructor(private files: FilesService) {}

  @Get(':id')
  async download(@Param('id') id: string, @CurrentUser() user: AuthUser, @Res() res: Response) {
    await this.files.assertCanRead(user, id);
    const file = await this.files.read(id);
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${file.filename}"`);
    // Uploaded documents must never execute as a page, even if mis-detected.
    res.setHeader('Content-Security-Policy', "sandbox; default-src 'none'");
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.send(Buffer.from(file.data));
  }
}
