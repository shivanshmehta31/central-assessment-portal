import { Controller, Get, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { DatasetsService } from './datasets.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'FACULTY')
@Controller('datasets')
export class DatasetsController {
  constructor(private datasets: DatasetsService) {}

  @Get()
  list() {
    return this.datasets.list();
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  upload(@UploadedFile() file: Express.Multer.File) {
    return this.datasets.upload(file);
  }
}
