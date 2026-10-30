import { Module } from "@nestjs/common";
import { AuthModule } from "./auth/auth.module";
import { AccountsModule } from "./accounts/accounts.module";
import { UsersModule } from "./users/users.module";
import { ReportsModule } from "./reports/reports.module";
import { ShopModule } from "./shop/shop.module";
import { PartiesModule } from "./parties/parties.module";
import { ExpensesModule } from "./expenses/expenses.module";
import { DocumentsModule } from "./documents/documents.module";
import { PurchasesModule } from "./purchases/purchases.module";
@Module({
  imports: [
    AuthModule,
    AccountsModule,
    UsersModule,
    ReportsModule,
    ShopModule,
    PartiesModule,
    ExpensesModule,
    DocumentsModule,
    PurchasesModule,
  ],
})
export class AppModule {}
