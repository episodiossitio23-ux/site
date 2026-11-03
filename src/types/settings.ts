export interface StoreSettings {
  store_name: string;
  contact_email: string;
  contact_phone: string;
  pickup_address: string;
  pickup_hours: string;
}

export interface ShippingMethod {
  id: string;
  name: string;
  description: string;
  price_cents: number;
  is_active: boolean;
  sort_order: number;
}

export interface SmtpSettings {
  is_active: boolean;
  host: string;
  port: number;
  secure: boolean;
  username: string;
  from_name: string;
  from_email: string;
}
