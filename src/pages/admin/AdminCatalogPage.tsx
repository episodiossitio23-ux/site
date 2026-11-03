import { useEffect, useState } from 'react';
import { Plus, Save } from 'lucide-react';
import AdminShell from '@/components/admin/AdminShell';
import { useCatalog } from '@/hooks/useCatalog';
import { formatBRL } from '@/lib/format';
import { parseReaisToCents, centsToReaisInput } from '@/lib/money';
import { supabase } from '@/lib/supabase';
import { SettingsCard, SettingsField } from '@/components/admin/settings/SettingsParts';
import ToggleSwitch from '@/components/admin/settings/ToggleSwitch';
import type { CatalogCategory, CatalogProductType, CatalogProductWithVariants } from '@/types/catalog';

const PRODUCT_TYPES: { value: CatalogProductType; label: string }[] = [
  { value: 'foto', label: 'Foto' },
  { value: 'polaroid', label: 'Polaroid' },
  { value: 'kit', label: 'Kit' },
  { value: 'personalizado', label: 'Personalizado' },
];

function slugify(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export default function AdminCatalogPage() {
  const { categories, products, loading, error } = useCatalog(true);
  const [categoryRows, setCategoryRows] = useState<CatalogCategory[]>([]);
  const [productRows, setProductRows] = useState<CatalogProductWithVariants[]>([]);
  const [categoryName, setCategoryName] = useState('');
  const [productForm, setProductForm] = useState({ category_id: '', name: '', description: '', product_type: 'foto' as CatalogProductType });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    setCategoryRows(categories);
    setProductRows(products);
    setProductForm((current) => ({ ...current, category_id: current.category_id || categories[0]?.id || '' }));
  }, [categories, products]);

  const createCategory = async () => {
    const name = categoryName.trim();
    if (name.length < 2) return setFormError('Informe o nome da categoria.');
    setSaving(true);
    setFormError(null);
    const { data, error: insertError } = await supabase.from('catalog_categories').insert({ name, slug: slugify(name), description: '' }).select('*').maybeSingle();
    setSaving(false);
    if (insertError || !data) return setFormError('Não foi possível criar a categoria.');
    setCategoryRows((current) => [...current, data as CatalogCategory]);
    setCategoryName('');
    setMessage('Categoria criada.');
  };

  const createProduct = async () => {
    const name = productForm.name.trim();
    if (!productForm.category_id || name.length < 2) return setFormError('Escolha uma categoria e informe o nome do produto.');
    setSaving(true);
    setFormError(null);
    const { data, error: insertError } = await supabase.from('catalog_products').insert({
      category_id: productForm.category_id,
      name,
      slug: `${slugify(name)}-${Date.now()}`,
      description: productForm.description.trim(),
      product_type: productForm.product_type,
    }).select('*').maybeSingle();
    setSaving(false);
    if (insertError || !data) return setFormError('Não foi possível criar o produto.');
    setProductRows((current) => [...current, { ...(data as CatalogProductWithVariants), variants: [] }]);
    setProductForm((current) => ({ ...current, name: '', description: '' }));
    setMessage('Produto criado. Adicione variantes e preços pelo cadastro correspondente.');
  };

  const updateProduct = async (product: CatalogProductWithVariants, patch: Partial<CatalogProductWithVariants>) => {
    const { data, error: updateError } = await supabase.from('catalog_products').update(patch).eq('id', product.id).select('*').maybeSingle();
    if (updateError || !data) {
      setFormError('Não foi possível atualizar o produto.');
      return;
    }
    setProductRows((current) => current.map((item) => item.id === product.id ? { ...(data as CatalogProductWithVariants), variants: item.variants } : item));
  };

  const updateVariant = async (product: CatalogProductWithVariants, variantId: string, priceInput: string) => {
    const price = parseReaisToCents(priceInput);
    if (price === null) return setFormError('Informe um preço válido.');
    const { data, error: updateError } = await supabase.from('catalog_variants').update({ price_cents: price }).eq('id', variantId).select('*').maybeSingle();
    if (updateError || !data) return setFormError('Não foi possível atualizar o preço.');
    setProductRows((current) => current.map((item) => item.id === product.id ? { ...item, variants: item.variants.map((variant) => variant.id === variantId ? data : variant) } : item));
  };

  return (
    <AdminShell>
      <main className="mx-auto max-w-6xl space-y-6 px-6 py-10 animate-fade-in">
        <div>
          <h1 className="font-display text-3xl text-stone-900">Catálogo</h1>
          <p className="mt-1 text-sm text-stone-500">Organize os produtos que aparecem para seus clientes.</p>
        </div>
        {error && <p className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</p>}
        {formError && <p className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{formError}</p>}
        {message && <p className="rounded-xl bg-sage-50 p-4 text-sm text-sage-700">{message}</p>}

        <div className="grid gap-6 lg:grid-cols-2">
          <SettingsCard title="Nova categoria">
            <SettingsField label="Nome" value={categoryName} onChange={setCategoryName} placeholder="Ex.: Álbuns" />
            <button onClick={() => void createCategory()} disabled={saving} className="flex w-fit items-center gap-2 rounded-full bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-clay-600 disabled:opacity-60"><Plus size={16} /> Criar categoria</button>
          </SettingsCard>
          <SettingsCard title="Novo produto">
            <label className="block"><span className="text-sm font-medium text-stone-700">Categoria</span><select value={productForm.category_id} onChange={(event) => setProductForm((current) => ({ ...current, category_id: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm"><option value="">Selecione</option>{categoryRows.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
            <SettingsField label="Nome" value={productForm.name} onChange={(name) => setProductForm((current) => ({ ...current, name }))} />
            <SettingsField label="Descrição" value={productForm.description} onChange={(description) => setProductForm((current) => ({ ...current, description }))} multiline />
            <label className="block"><span className="text-sm font-medium text-stone-700">Tipo</span><select value={productForm.product_type} onChange={(event) => setProductForm((current) => ({ ...current, product_type: event.target.value as CatalogProductType }))} className="mt-1.5 w-full rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm">{PRODUCT_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label>
            <button onClick={() => void createProduct()} disabled={saving} className="flex w-fit items-center gap-2 rounded-full bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-clay-600 disabled:opacity-60"><Plus size={16} /> Criar produto</button>
          </SettingsCard>
        </div>

        <SettingsCard title="Produtos cadastrados">
          {loading && <p className="text-sm text-stone-500">Carregando...</p>}
          {!loading && productRows.length === 0 && <p className="text-sm text-stone-500">Nenhum produto cadastrado.</p>}
          <div className="space-y-4">
            {productRows.map((product) => (
              <article key={product.id} className="rounded-2xl border border-stone-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div><p className="font-medium text-stone-900">{product.name}</p><p className="mt-1 text-sm text-stone-500">{categoryRows.find((category) => category.id === product.category_id)?.name ?? 'Sem categoria'}</p></div>
                  <div className="flex items-center gap-4"><label className="flex items-center gap-2 text-xs text-stone-600">Destaque <ToggleSwitch checked={product.is_featured} onChange={(value) => void updateProduct(product, { is_featured: value })} label={`Destacar ${product.name}`} /></label><label className="flex items-center gap-2 text-xs text-stone-600">Ativo <ToggleSwitch checked={product.is_active} onChange={(value) => void updateProduct(product, { is_active: value })} label={`Ativar ${product.name}`} /></label></div>
                </div>
                <p className="mt-3 text-sm text-stone-600">{product.description || 'Sem descrição.'}</p>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {product.variants.map((variant) => <VariantRow key={variant.id} product={product} variant={variant} onSave={updateVariant} />)}
                  {product.variants.length === 0 && <p className="text-sm text-amber-700">Este produto ainda não possui opções de preço.</p>}
                </div>
              </article>
            ))}
          </div>
        </SettingsCard>
      </main>
    </AdminShell>
  );
}

function VariantRow({ product, variant, onSave }: { product: CatalogProductWithVariants; variant: CatalogProductWithVariants['variants'][number]; onSave: (product: CatalogProductWithVariants, variantId: string, price: string) => Promise<void> }) {
  const [price, setPrice] = useState(centsToReaisInput(variant.price_cents));
  const dirty = parseReaisToCents(price) !== variant.price_cents;
  return <div className="flex items-center justify-between gap-3 rounded-xl bg-stone-50 px-3 py-2"><div><p className="text-sm font-medium text-stone-800">{variant.name}</p><p className="text-xs text-stone-500">{variant.finish_name} · {variant.production_days} dias · atual {formatBRL(variant.price_cents)}</p></div><div className="flex items-center gap-2"><input value={price} onChange={(event) => setPrice(event.target.value)} className="w-24 rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-sm" aria-label={`Preço de ${variant.name}`} />{dirty && <button onClick={() => void onSave(product, variant.id, price)} className="rounded-lg bg-stone-900 p-2 text-white transition hover:bg-clay-600" aria-label={`Salvar preço de ${variant.name}`}><Save size={14} /></button>}</div></div>;
}
