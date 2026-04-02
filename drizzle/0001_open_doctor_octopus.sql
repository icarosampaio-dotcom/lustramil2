CREATE TABLE `entities` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`type` enum('fornecedor','cliente') NOT NULL,
	`document` varchar(20),
	`phone` varchar(20),
	`email` varchar(320),
	`address` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `entities_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `invoice_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`invoiceId` int NOT NULL,
	`productId` int,
	`productName` varchar(255) NOT NULL,
	`quantity` decimal(12,3) NOT NULL,
	`unitPrice` decimal(12,2),
	`totalPrice` decimal(14,2),
	`unit` varchar(20),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `invoice_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `invoices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`invoiceNumber` varchar(50),
	`type` enum('entrada','saida') NOT NULL,
	`entityId` int,
	`entityName` varchar(255),
	`issueDate` timestamp,
	`totalValue` decimal(14,2) DEFAULT '0',
	`fileUrl` text,
	`fileKey` text,
	`status` enum('processando','concluido','erro') NOT NULL DEFAULT 'processando',
	`rawExtraction` text,
	`userId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `invoices_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`category` varchar(100),
	`unit` varchar(20) NOT NULL DEFAULT 'un',
	`currentStock` decimal(12,3) NOT NULL DEFAULT '0',
	`minStock` decimal(12,3) NOT NULL DEFAULT '0',
	`lastPrice` decimal(12,2) DEFAULT '0',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `products_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `stock_movements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`invoiceId` int,
	`type` enum('entrada','saida') NOT NULL,
	`quantity` decimal(12,3) NOT NULL,
	`unitPrice` decimal(12,2),
	`totalPrice` decimal(14,2),
	`balanceAfter` decimal(12,3),
	`userId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `stock_movements_id` PRIMARY KEY(`id`)
);
