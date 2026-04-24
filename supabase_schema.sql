-- GEMA Manager - Supabase SQL Schema Migration
-- ====================================================================
-- INSTRUCÕES DE USO:
-- 1. Copie TODO o conteúdo deste arquivo.
-- 2. Vá para o seu Dashboard do Supabase -> SQL Editor -> New Query.
-- 3. Cole o código e clique em "RUN".
-- 4. Se o erro "Could not find column... in the schema cache" persistir:
--    Vá em "API Settings" no Supabase e clique em "Reload PostgREST" (ou similar)
--    Alternativamente, tente fazer Logout e Login no seu app.
-- ====================================================================

-- Enable Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Profiles (Users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    name TEXT,
    email TEXT UNIQUE,
    photo_url TEXT,
    approved BOOLEAN DEFAULT FALSE,
    role TEXT DEFAULT 'pending' CHECK (role IN ('pending', 'admin', 'seller', 'driver')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Admin Verification
CREATE TABLE IF NOT EXISTS public.admins (
    user_id UUID REFERENCES auth.users PRIMARY KEY
);

-- Function to handle new user registration automatically
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, role, approved)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'name',
    NEW.email,
    CASE WHEN NEW.email = 'mattos.mmn@gmail.com' THEN 'admin' ELSE 'pending' END,
    CASE WHEN NEW.email = 'mattos.mmn@gmail.com' THEN TRUE ELSE FALSE END
  );
  
  -- If it's the owner, also add to admins table
  IF NEW.email = 'mattos.mmn@gmail.com' THEN
    INSERT INTO public.admins (user_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new auth users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 2. Staff: Sellers
CREATE TABLE IF NOT EXISTS public.sellers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    auth_uid TEXT,
    active BOOLEAN DEFAULT TRUE,
    permissions JSONB DEFAULT '{"can_edit_clients": true, "can_view_finance": false, "can_manage_stock": false, "can_give_discount": false}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sellers' AND column_name='auth_uid') THEN
        ALTER TABLE public.sellers ADD COLUMN auth_uid TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sellers' AND column_name='permissions') THEN
        ALTER TABLE public.sellers ADD COLUMN permissions JSONB DEFAULT '{"can_edit_clients": true, "can_view_finance": false, "can_manage_stock": false, "can_give_discount": false}'::jsonb;
    END IF;
END $$;

-- 3. Staff: Drivers (Entregadores)
CREATE TABLE IF NOT EXISTS public.drivers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    auth_uid TEXT,
    phone TEXT,
    vehicle TEXT,
    vehicle_plate TEXT,
    payment_type TEXT DEFAULT 'fixo',
    fixed_value DECIMAL DEFAULT 0,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='drivers' AND column_name='auth_uid') THEN
        ALTER TABLE public.drivers ADD COLUMN auth_uid TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='drivers' AND column_name='vehicle_plate') THEN
        ALTER TABLE public.drivers ADD COLUMN vehicle_plate TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='drivers' AND column_name='phone') THEN
        ALTER TABLE public.drivers ADD COLUMN phone TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='drivers' AND column_name='vehicle') THEN
        ALTER TABLE public.drivers ADD COLUMN vehicle TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='drivers' AND column_name='payment_type') THEN
        ALTER TABLE public.drivers ADD COLUMN payment_type TEXT DEFAULT 'fixo';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='drivers' AND column_name='fixed_value') THEN
        ALTER TABLE public.drivers ADD COLUMN fixed_value DECIMAL DEFAULT 0;
    END IF;
END $$;

-- 4. Clients
CREATE TABLE IF NOT EXISTS public.clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    phone TEXT,
    whatsapp TEXT,
    address TEXT,
    number TEXT,
    district TEXT,
    city TEXT,
    notes TEXT,
    type TEXT DEFAULT 'final' CHECK (type IN ('final', 'reseller')),
    cpf TEXT,
    birth_date DATE,
    extra_details TEXT,
    lat DECIMAL,
    lng DECIMAL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clients' AND column_name='type') THEN
        ALTER TABLE public.clients ADD COLUMN type TEXT DEFAULT 'final' CHECK (type IN ('final', 'reseller'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clients' AND column_name='whatsapp') THEN
        ALTER TABLE public.clients ADD COLUMN whatsapp TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clients' AND column_name='address') THEN
        ALTER TABLE public.clients ADD COLUMN address TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clients' AND column_name='number') THEN
        ALTER TABLE public.clients ADD COLUMN number TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clients' AND column_name='district') THEN
        ALTER TABLE public.clients ADD COLUMN district TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clients' AND column_name='city') THEN
        ALTER TABLE public.clients ADD COLUMN city TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clients' AND column_name='cpf') THEN
        ALTER TABLE public.clients ADD COLUMN cpf TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clients' AND column_name='birth_date') THEN
        ALTER TABLE public.clients ADD COLUMN birth_date DATE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clients' AND column_name='extra_details') THEN
        ALTER TABLE public.clients ADD COLUMN extra_details TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clients' AND column_name='lat') THEN
        ALTER TABLE public.clients ADD COLUMN lat DECIMAL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clients' AND column_name='lng') THEN
        ALTER TABLE public.clients ADD COLUMN lng DECIMAL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clients' AND column_name='notes') THEN
        ALTER TABLE public.clients ADD COLUMN notes TEXT;
    END IF;
END $$;

-- 5. Products
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    category_id TEXT DEFAULT 'geral',
    type TEXT DEFAULT 'simple' CHECK (type IN ('simple', 'kit')),
    cost_price DECIMAL DEFAULT 0,
    sale_price DECIMAL DEFAULT 0,
    stock INTEGER DEFAULT 0,
    min_stock INTEGER DEFAULT 5,
    commission_value DECIMAL DEFAULT 0,
    active BOOLEAN DEFAULT TRUE,
    image_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure columns exist if table was already created without them
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='commission_value') THEN
        ALTER TABLE public.products ADD COLUMN commission_value DECIMAL DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='cost_price') THEN
        ALTER TABLE public.products ADD COLUMN cost_price DECIMAL DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='category_id') THEN
        ALTER TABLE public.products ADD COLUMN category_id TEXT DEFAULT 'geral';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='image_url') THEN
        ALTER TABLE public.products ADD COLUMN image_url TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='min_stock') THEN
        ALTER TABLE public.products ADD COLUMN min_stock INTEGER DEFAULT 5;
    END IF;
END $$;

-- 6. Kit Composition (Relationship)
CREATE TABLE IF NOT EXISTS public.kit_items (
    kit_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id),
    quantity INTEGER DEFAULT 1,
    PRIMARY KEY (kit_id, product_id)
);

-- 7. Orders (Sales)
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES public.clients(id),
    seller_id UUID REFERENCES public.sellers(id),
    driver_id UUID REFERENCES public.drivers(id),
    total DECIMAL DEFAULT 0,
    subtotal DECIMAL DEFAULT 0,
    delivery_fee DECIMAL DEFAULT 0,
    discount DECIMAL DEFAULT 0,
    notes TEXT,
    delivery_date_predicted TIMESTAMPTZ,
    status TEXT DEFAULT 'novo',
    payment_method TEXT DEFAULT 'pix',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='delivery_fee') THEN
        ALTER TABLE public.orders ADD COLUMN delivery_fee DECIMAL DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='discount') THEN
        ALTER TABLE public.orders ADD COLUMN discount DECIMAL DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='subtotal') THEN
        ALTER TABLE public.orders ADD COLUMN subtotal DECIMAL DEFAULT 0;
    END IF;
END $$;

-- 8. Order Items
CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id),
    name TEXT,
    quantity INTEGER DEFAULT 1,
    price DECIMAL NOT NULL,
    commission DECIMAL DEFAULT 0
);

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='order_items' AND column_name='commission') THEN
        ALTER TABLE public.order_items ADD COLUMN commission DECIMAL DEFAULT 0;
    END IF;
END $$;

-- 9. Stock Movements
CREATE TABLE IF NOT EXISTS public.stock_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID REFERENCES public.products(id),
    type TEXT CHECK (type IN ('in', 'out')),
    quantity INTEGER NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Transactions (Finance)
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type TEXT CHECK (type IN ('income', 'expense')),
    value DECIMAL NOT NULL,
    description TEXT,
    order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    category TEXT,
    date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Settings
CREATE TABLE IF NOT EXISTS public.settings (
    id TEXT PRIMARY KEY, -- Using id as primary key to avoid reserved word 'key' issues in some contexts
    value JSONB
);

-- Ensure table has correct columns if it existed previously
DO $$ 
BEGIN 
    -- If table has 'key' instead of 'id', rename it
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='settings' AND column_name='key') THEN
        ALTER TABLE public.settings RENAME COLUMN "key" TO id;
    END IF;
    
    -- Ensure columns exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='settings' AND column_name='id') THEN
        ALTER TABLE public.settings ADD COLUMN id TEXT PRIMARY KEY;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='settings' AND column_name='value') THEN
        ALTER TABLE public.settings ADD COLUMN value JSONB;
    END IF;
END $$;

-- Initial Content for Settings
INSERT INTO public.settings (id, value) VALUES ('config', '{
    "order_statuses": [
        {"id": "novo", "label": "Pedido feito", "color": "blue"},
        {"id": "confirmado", "label": "Confirmado", "color": "emerald"},
        {"id": "em-rota", "label": "Em rota", "color": "purple"},
        {"id": "entregue", "label": "Entregue", "color": "slate"},
        {"id": "cancelado", "label": "Cancelado", "color": "red"},
        {"id": "remarcado", "label": "Remarcado", "color": "orange"}
    ],
    "default_delivery_fee": 0
}'::jsonb) ON CONFLICT (id) DO NOTHING;

-- ROW LEVEL SECURITY (RLS) policies

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sellers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kit_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- General Policies (Standard authenticated access for view/read)
-- Initial broader access to ensure system functions while owner sets up specific permissions
DROP POLICY IF EXISTS "Auth access profiles" ON public.profiles;
DROP POLICY IF EXISTS "Auth access sellers" ON public.sellers;
DROP POLICY IF EXISTS "Auth access drivers" ON public.drivers;
DROP POLICY IF EXISTS "Auth access products" ON public.products;
DROP POLICY IF EXISTS "Auth access kit_items" ON public.kit_items;
DROP POLICY IF EXISTS "Auth access clients" ON public.clients;
DROP POLICY IF EXISTS "Auth access orders" ON public.orders;
DROP POLICY IF EXISTS "Auth access order_items" ON public.order_items;
DROP POLICY IF EXISTS "Auth access stock_movements" ON public.stock_movements;
DROP POLICY IF EXISTS "Auth access transactions" ON public.transactions;
DROP POLICY IF EXISTS "Auth access settings" ON public.settings;

CREATE POLICY "Auth access profiles" ON public.profiles FOR ALL TO authenticated USING (true);
CREATE POLICY "Auth access sellers" ON public.sellers FOR ALL TO authenticated USING (true);
CREATE POLICY "Auth access drivers" ON public.drivers FOR ALL TO authenticated USING (true);
CREATE POLICY "Auth access products" ON public.products FOR ALL TO authenticated USING (true);
CREATE POLICY "Auth access kit_items" ON public.kit_items FOR ALL TO authenticated USING (true);
CREATE POLICY "Auth access clients" ON public.clients FOR ALL TO authenticated USING (true);
CREATE POLICY "Auth access orders" ON public.orders FOR ALL TO authenticated USING (true);
CREATE POLICY "Auth access order_items" ON public.order_items FOR ALL TO authenticated USING (true);
CREATE POLICY "Auth access stock_movements" ON public.stock_movements FOR ALL TO authenticated USING (true);
CREATE POLICY "Auth access transactions" ON public.transactions FOR ALL TO authenticated USING (true);
CREATE POLICY "Auth access settings" ON public.settings FOR ALL TO authenticated USING (true);

-- Functions and Triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_clients_updated_at ON public.clients;
CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_products_updated_at ON public.products;
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_orders_updated_at ON public.orders;
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_sellers_updated_at ON public.sellers;
CREATE TRIGGER update_sellers_updated_at BEFORE UPDATE ON public.sellers FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_drivers_updated_at ON public.drivers;
CREATE TRIGGER update_drivers_updated_at BEFORE UPDATE ON public.drivers FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
