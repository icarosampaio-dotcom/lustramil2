ALTER TABLE `invoice_items` ADD `productReference` varchar(100);--> statement-breakpoint
ALTER TABLE `invoice_items` ADD `cfop` varchar(10);--> statement-breakpoint
ALTER TABLE `invoices` ADD `entityDocument` varchar(20);--> statement-breakpoint
ALTER TABLE `products` ADD `reference` varchar(100);--> statement-breakpoint
ALTER TABLE `products` ADD `barcode` varchar(50);--> statement-breakpoint
ALTER TABLE `stock_movements` ADD `cfop` varchar(10);