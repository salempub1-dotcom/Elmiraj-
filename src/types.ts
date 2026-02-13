export interface Product {
  id: number;
  name: string;
  description: string;
  longDescription: string;
  price: number;
  originalPrice?: number;
  image: string;
  category: string;
  grade: 'preparatory' | 'elementary' | 'middle';
  year?: number; // السنة داخل الطور
  language: 'english' | 'french';
  cardCount: number;
  benefits: string[];
  inStock: boolean;
  badge?: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface GradeYear {
  year: number;
  label: string;
}

export interface GradeInfo {
  id: string;
  name: string;
  icon: string;
  color: string;
  bgGradient: string;
  description: string;
  years: GradeYear[];
}

export type Grade = 'preparatory' | 'elementary' | 'middle';
export type View = 'home' | 'products' | 'product-detail' | 'checkout' | 'tracking';
