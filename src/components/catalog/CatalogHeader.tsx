"use client";

import React from "react";
import { Search, Camera, ShoppingBag, Plus } from "lucide-react";
import AdminAiChatbot from "@/components/AdminAiChatbot";
import { PriceMode } from "./types";

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"

interface CatalogHeaderProps {
	searchQuery: string;
	onSearchChange: (query: string) => void;
	isAdmin: boolean;
	onOpenAddProduct: () => void;
	onOpenScanner: () => void;
	onOpenCart: () => void;
	totalCartCount: number;
	priceMode: PriceMode;
	onTogglePriceMode: (mode: PriceMode) => void;
	onOpenLogin: () => void;
	onLogout: () => void;
	categories: string[];
}

export default function CatalogHeader({
	searchQuery,
	onSearchChange,
	isAdmin,
	onOpenAddProduct,
	onOpenScanner,
	onOpenCart,
	totalCartCount,
	priceMode,
	onTogglePriceMode,
	onOpenLogin,
	onLogout,
	categories,
}: CatalogHeaderProps) {
	return (
		<header>
			<div className="flex flex-col gap-y-2">
				<section className="flex flex-row justify-between items-center">
					<div className="flex flex-row gap-x-2 items-center">
						<div className="brand-mark">G</div>
						<div className="flex flex-col gap-y-0">
							<h1 className="font-semibold">Growsary</h1>
							<span className="text-xs">Track your prices in seconds!</span>
						</div>
					</div>

					<div className="admin-zone">
						<Button size={'xs'} variant="outline" className={`border-zinc-300 rounded-[9px] text-xs ${!isAdmin ? 'bg-black text-white border-none' : ''}`} onClick={() => (isAdmin ? onLogout() : onOpenLogin())}>
							{isAdmin ? "Log out" : "Admin Login"}
						</Button>
					</div>

				</section>

				<div className="flex flex-row gap-x-2">
					<InputGroup className="w-full border-zinc-300 rounded-[9px]">
						<InputGroupInput placeholder="Search..." value={searchQuery} onChange={(e) => onSearchChange(e.target.value)} />
						<InputGroupAddon>
							<Search />
						</InputGroupAddon>
					</InputGroup>
					<Button variant="outline" className="border-zinc-300 rounded-[9px]" onClick={onOpenScanner}>
						<Camera data-icon="inline-start" />
					</Button>
					<Button variant="outline" className="border-zinc-300 rounded-[9px] relative" onClick={onOpenCart}>
						<ShoppingBag data-icon="inline-start" />
						{totalCartCount > 0 && (
							<span className="cart-count">{totalCartCount}</span>
						)}
					</Button>
				</div>

				{/* Inline Admin Action Bar */}
				<div className="flex flex-row justify-between">
					<div className={`price-toggle ${priceMode}`} id="priceToggle">
						<div className="knob"></div>
						<button onClick={() => onTogglePriceMode("retail")}>Retail</button>
						<button onClick={() => onTogglePriceMode("wholesale")}>Wholesale</button>
					</div>
					{isAdmin && (
						<div className="admin-actions-bar" style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
							<Button variant="outline" className="border-zinc-300 rounded-[9px] text-xs" onClick={onOpenAddProduct}>
								<Plus data-icon="inline-start" /> Add Item
							</Button>
							<AdminAiChatbot existingCategories={categories} />
						</div>
					)}
				</div>

			</div>
		</header>
	);
}
