import { Controller, Get, Logger } from '@nestjs/common';
import { CatalogService, CatalogItem } from './catalog.service';

@Controller('catalog')
export class CatalogController {
  private readonly logger = new Logger(CatalogController.name);

  constructor(private readonly catalogService: CatalogService) {}

  /**
   * GET /api/catalog
   * Public endpoint – returns catalog items from YouTube playlists (when configured)
   * or from database programs. Uses YouTube thumbnails instead of stock images.
   */
  @Get()
  async getCatalog(): Promise<CatalogItem[]> {
    this.logger.log('Getting catalog items');
    return this.catalogService.getCatalogItems();
  }
}
