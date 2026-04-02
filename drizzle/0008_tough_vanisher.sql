CREATE TABLE `ficha_tecnica` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`insumoId` int NOT NULL,
	`quantityPerUnit` decimal(12,4) NOT NULL,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ficha_tecnica_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `insumos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`category` varchar(100),
	`unit` varchar(20) NOT NULL DEFAULT 'un',
	`currentStock` decimal(12,3) NOT NULL DEFAULT '0',
	`minStock` decimal(12,3) NOT NULL DEFAULT '0',
	`unitPrice` decimal(12,4) NOT NULL DEFAULT '0',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `insumos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `production_orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`quantity` decimal(12,3) NOT NULL,
	`status` enum('pendente','em_producao','concluida','cancelada') NOT NULL DEFAULT 'pendente',
	`productionDate` timestamp,
	`totalCost` decimal(14,2),
	`notes` text,
	`userId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `production_orders_id` PRIMARY KEY(`id`)
);
