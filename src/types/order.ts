import type { OrderStatus } from '@/lib/orderStatus';
import type { CaptionStyle, CropTransform } from '@/types/store';

export interface AdminOrder {
  id: string;
  order_number: number;
  status: OrderStatus;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  delivery_cep: string;
  delivery_street: string;
  delivery_number: string;
  delivery_complement: string;
  delivery_neighborhood: string;
  delivery_city: string;
  delivery_state: string;
  subtotal_cents: number;
  total_cents: number;
  shipping_cents: number;
  fulfillment_type: 'envio' | 'retirada';
  shipping_method_name: string;
  pickup_address: string;
  tracking_code: string;
  created_at: string;
}

export interface OrderStatusHistory {
  id: string;
  previous_status: OrderStatus | null;
  new_status: OrderStatus;
  changed_by: string | null;
  created_at: string;
}

export interface AdminOrderItem {
  id: string;
  position: number;
  format_label: string;
  quantity: number;
  unit_price_cents: number;
  line_total_cents: number;
  caption: string;
  original_name: string;
  original_path: string;
  print_path: string;
}

export interface CustomerOrder {
  id: string;
  order_number: number;
  status: OrderStatus;
  total_cents: number;
  shipping_cents: number;
  fulfillment_type: 'envio' | 'retirada';
  shipping_method_name: string;
  pickup_address: string;
  tracking_code: string;
  delivery_street: string;
  delivery_number: string;
  delivery_complement: string;
  delivery_neighborhood: string;
  delivery_city: string;
  delivery_state: string;
  delivery_cep: string;
  created_at: string;
}

export interface CustomerOrderItem {
  id: string;
  format_id: string;
  format_label: string;
  quantity: number;
  line_total_cents: number;
  caption: string;
  caption_style: Partial<CaptionStyle>;
  crop_settings: Partial<CropTransform>;
  original_name: string;
  original_path: string;
}
