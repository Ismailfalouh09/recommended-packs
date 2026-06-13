import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { AttributesModule } from './modules/attributes/attributes.module';
import { BrandsModule } from './modules/brands/brands.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { MediaModule } from './modules/media/media.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PacksModule } from './modules/packs/packs.module';
import { ProductReferencesModule } from './modules/product-references/product-references.module';
import { ProductsModule } from './modules/products/products.module';
import { QuizModule } from './modules/quiz/quiz.module';
import { RecommendationsModule } from './modules/recommendations/recommendations.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    AttributesModule,
    CategoriesModule,
    BrandsModule,
    QuizModule,
    ProductsModule,
    ProductReferencesModule,
    PacksModule,
    RecommendationsModule,
    OrdersModule,
    MediaModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
