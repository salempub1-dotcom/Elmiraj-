export interface Product {
  id: number;
  name: string;
  description: string;
  longDescription: string;
  price: number;
  originalPrice?: number;
  image: string;
  category: string;
  grade: string;
  language: 'english' | 'french' | 'both';
  cardCount: number;
  benefits: string[];
  inStock: boolean;
  badge?: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export type Grade = 'kindergarten' | 'grade3' | 'elementary' | 'middle';
export type View = 'home' | 'products' | 'product-detail' | 'checkout';
