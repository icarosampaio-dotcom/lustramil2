CREATE TABLE `accounts_payable` (
	`id` int AUTO_INCREMENT NOT NULL,
	`description` varchar(500) NOT NULL,
	`value` decimal(14,2) NOT NULL,
	`dueDate` timestamp NOT NULL,
	`status` enum('pendente','pago','vencido') NOT NULL DEFAULT 'pendente',
	`paidDate` timestamp,
	`paidValue` decimal(14,2),
	`categoryId` int,
	`entityId` int,
	`entityName` varchar(255),
	`accountId` int,
	`notes` text,
	`userId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `accounts_payable_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `accounts_receivable` (
	`id` int AUTO_INCREMENT NOT NULL,
	`description` varchar(500) NOT NULL,
	`value` decimal(14,2) NOT NULL,
	`expectedDate` timestamp NOT NULL,
	`status` enum('pendente','recebido','vencido') NOT NULL DEFAULT 'pendente',
	`receivedDate` timestamp,
	`receivedValue` decimal(14,2),
	`entityId` int,
	`entityName` varchar(255),
	`accountId` int,
	`notes` text,
	`userId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `accounts_receivable_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cash_movements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`date` timestamp NOT NULL,
	`type` enum('entrada','saida') NOT NULL,
	`description` varchar(500) NOT NULL,
	`value` decimal(14,2) NOT NULL,
	`categoryId` int,
	`accountId` int,
	`notes` text,
	`userId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cash_movements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `expense_categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`type` enum('fixa','variavel') NOT NULL DEFAULT 'variavel',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `expense_categories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `financial_accounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`type` enum('caixa','conta_corrente','cartao','poupanca','outro') NOT NULL DEFAULT 'caixa',
	`initialBalance` decimal(14,2) NOT NULL DEFAULT '0',
	`currentBalance` decimal(14,2) NOT NULL DEFAULT '0',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `financial_accounts_id` PRIMARY KEY(`id`)
);
