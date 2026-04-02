CREATE TABLE `commission_configs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientName` varchar(255) NOT NULL,
	`cnpjPattern` varchar(20),
	`percentage` decimal(5,2) NOT NULL,
	`userId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `commission_configs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sales_data` (
	`id` int AUTO_INCREMENT NOT NULL,
	`batchId` int NOT NULL,
	`cnpj` varchar(20) NOT NULL,
	`saleDate` timestamp NOT NULL,
	`productCode` varchar(50) NOT NULL,
	`internalCode` varchar(50) NOT NULL,
	`description` varchar(500) NOT NULL,
	`quantity` decimal(12,3) NOT NULL,
	`grossSale` decimal(14,2) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sales_data_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sales_import_batches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`fileName` varchar(255) NOT NULL,
	`clientName` varchar(255),
	`periodStart` timestamp,
	`periodEnd` timestamp,
	`totalRecords` int NOT NULL DEFAULT 0,
	`totalValue` decimal(14,2) DEFAULT '0',
	`userId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sales_import_batches_id` PRIMARY KEY(`id`)
);
