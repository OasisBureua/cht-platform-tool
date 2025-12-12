import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { VideosService } from './videos.service';
import { CreateVideoDto } from './dto/create-video.dto';
import { UpdateVideoDto } from './dto/update-video.dto';
import { TrackVideoViewDto } from './dto/track-video-view.dto';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';

@Controller('videos')
export class VideosController {
  constructor(private readonly videosService: VideosService) {}

  @Post()
  @Roles('ADMIN')  // ← Only admins add videos
  create(@Body() createVideoDto: CreateVideoDto) {
    return this.videosService.create(createVideoDto);
  }

  @Get()
  // Anyone authenticated can view videos
  findAll(@Query('programId') programId?: string) {
    return this.videosService.findAll(programId);
  }

  @Get('my-history')
  // HCPs can see their watch history
  getMyHistory(@CurrentUser() user: any) {
    return this.videosService.getUserVideoHistory(user.userId);
  }

  @Get(':id')
  // Anyone authenticated can view video details
  findOne(@Param('id') id: string) {
    return this.videosService.findOne(id);
  }

  @Post(':id/track')
  // HCPs track their progress
  trackView(
    @Param('id') videoId: string,
    @CurrentUser() user: any,
    @Body() trackViewDto: TrackVideoViewDto,
  ) {
    return this.videosService.trackView(videoId, user.userId, trackViewDto);
  }

  @Get(':id/my-progress')
  // HCPs see their own progress
  getMyProgress(@Param('id') videoId: string, @CurrentUser() user: any) {
    return this.videosService.getUserProgress(user.userId, videoId);
  }

  @Patch(':id')
  @Roles('ADMIN')  // ← Only admins update videos
  update(@Param('id') id: string, @Body() updateVideoDto: UpdateVideoDto) {
    return this.videosService.update(id, updateVideoDto);
  }

  @Delete(':id')
  @Roles('ADMIN')  // ← Only admins delete videos
  remove(@Param('id') id: string) {
    return this.videosService.remove(id);
  }
}