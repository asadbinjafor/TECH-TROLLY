import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { UsersController } from './users/users.controller';
import { CommandsController } from './accounts/commands.controller';
import { PostingService } from './accounts/posting.service';
import { ShopController } from './shop/shop.controller';
import { PartiesController } from './parties/parties.controller';
import { CategoriesController } from './expenses/categories.controller';
import { ReportsController } from './reports/reports.controller';
import { ReportsService } from './reports/reports.service';
import { DocumentsController } from './documents/documents.controller';
@Module({imports:[AuthModule],controllers:[UsersController,CommandsController,ShopController,PartiesController,CategoriesController,ReportsController,DocumentsController],providers:[PostingService,ReportsService]})
export class AppModule {}
