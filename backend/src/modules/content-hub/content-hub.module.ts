import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ContentHubClientService } from './content-hub-client.service';

@Module({
  imports: [
    HttpModule.register({
      timeout: 15000,
      maxRedirects: 5,
    }),
  ],
  providers: [ContentHubClientService],
  exports: [ContentHubClientService],
})
export class ContentHubModule {}
