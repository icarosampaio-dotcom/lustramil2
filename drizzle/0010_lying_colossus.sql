ALTER TABLE `invoices` ADD `invoiceSeries` varchar(10);--> statement-breakpoint
ALTER TABLE `invoices` ADD `invoiceHash` varchar(64);--> statement-breakpoint
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_invoiceHash_unique` UNIQUE(`invoiceHash`);