import { useEffect, useState } from "react";
import type { FilterOptions, Product } from "./types";

const emptyFilters: FilterOptions = { brands: [], color: [], category: [], style: [] };

export default function App() {
  const [filters, setFilters] = useState<FilterOptions>(emptyFilters);
  const [query, setQuery] = useState({ brand: "", color: "", category: "", style: "" });
  const [products, setProducts] = useState<Product[]>([]);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [textQuery, setTextQuery] = useState("");
  const [similarOf, setSimilarOf] = useState<Product | null>(null);
  const [similarResults, setSimilarResults] = useState<Product[]>([]);
  const [searching, setSearching] = useState(false);

  async function loadFilters() {
    const res = await fetch("/api/products/filters");
    setFilters(await res.json());
  }

  async function search() {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value) params.set(key, value);
    }
    const res = await fetch(`/api/products?${params.toString()}`);
    setProducts(await res.json());
  }

  useEffect(() => {
    loadFilters();
    search();
  }, []);

  async function searchByText() {
    if (!textQuery.trim()) return;
    setSearching(true);
    setSimilarOf(null);
    try {
      const res = await fetch(`/api/products/search/text?q=${encodeURIComponent(textQuery)}`);
      const data = await res.json();
      setSimilarResults(data.results ?? []);
    } finally {
      setSearching(false);
    }
  }

  async function showSimilar(p: Product) {
    setSimilarOf(p);
    setSearching(true);
    try {
      const res = await fetch(`/api/products/${p.id}/similar`);
      setSimilarResults(await res.json());
    } finally {
      setSearching(false);
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setMessage("");
    try {
      const formData = new FormData();
      formData.append("image", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) throw new Error(await res.text());
      const result = await res.json();
      setMessage(
        `업로드 완료: ${result.name} / ${result.tags.map((t: { value: string }) => t.value).join(", ")}`
      );
      await loadFilters();
      await search();
    } catch (err) {
      setMessage("업로드 실패: " + String(err));
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: 24, fontFamily: "sans-serif" }}>
      <h1>상품 이미지 태깅 · 검색</h1>
      <p style={{ color: "#666" }}>
        이미지를 업로드하면 AI가 색상/카테고리/스타일을 자동으로 태깅해서 DB에 저장하고,
        아래에서 조합 검색(SELECT + JOIN)으로 찾아볼 수 있습니다.
      </p>

      <section style={{ margin: "16px 0" }}>
        <input type="file" accept="image/*" onChange={handleUpload} disabled={uploading} />
        {uploading && <span> 태깅 중...</span>}
        {message && <div style={{ marginTop: 8 }}>{message}</div>}
      </section>

      <section style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "16px 0" }}>
        <select value={query.brand} onChange={(e) => setQuery({ ...query, brand: e.target.value })}>
          <option value="">브랜드 전체</option>
          {filters.brands.map((b) => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>
        <select value={query.color} onChange={(e) => setQuery({ ...query, color: e.target.value })}>
          <option value="">색상 전체</option>
          {filters.color.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select value={query.category} onChange={(e) => setQuery({ ...query, category: e.target.value })}>
          <option value="">카테고리 전체</option>
          {filters.category.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select value={query.style} onChange={(e) => setQuery({ ...query, style: e.target.value })}>
          <option value="">스타일 전체</option>
          {filters.style.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <button onClick={search}>검색</button>
      </section>

      <section style={{ display: "flex", gap: 8, margin: "16px 0" }}>
        <input
          type="text"
          placeholder="예: 레드 캐주얼 상의"
          value={textQuery}
          onChange={(e) => setTextQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && searchByText()}
          style={{ flex: 1, padding: 6 }}
        />
        <button onClick={searchByText} disabled={searching}>문장으로 비슷한 스타일 찾기</button>
      </section>

      <ProductGrid products={products} onSimilar={showSimilar} />

      {(similarOf || similarResults.length > 0 || searching) && (
        <section style={{ marginTop: 32, borderTop: "1px solid #ddd", paddingTop: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ fontSize: 16 }}>
              {similarOf ? `"${similarOf.name}"와 비슷한 상품` : `"${textQuery}" 검색 결과`}
            </h2>
            <button onClick={() => { setSimilarOf(null); setSimilarResults([]); }}>닫기</button>
          </div>
          {searching ? (
            <div style={{ color: "#999" }}>찾는 중...</div>
          ) : (
            <ProductGrid products={similarResults} onSimilar={showSimilar} />
          )}
        </section>
      )}
    </div>
  );
}

function ProductGrid({ products, onSimilar }: { products: Product[]; onSimilar: (p: Product) => void }) {
  if (products.length === 0) {
    return <div style={{ color: "#999" }}>검색 결과가 없습니다.</div>;
  }
  return (
    <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 16 }}>
      {products.map((p) => (
        <div key={p.id} style={{ border: "1px solid #ddd", borderRadius: 8, padding: 8 }}>
          <img
            src={`/uploads/${p.image_path}`}
            alt={p.name}
            style={{ width: "100%", height: 160, objectFit: "cover", borderRadius: 4 }}
          />
          <div style={{ fontWeight: 600, marginTop: 8 }}>{p.name}</div>
          {p.brand && <div style={{ color: "#888", fontSize: 13 }}>{p.brand}</div>}
          <div style={{ fontSize: 12, color: "#555", marginTop: 4 }}>
            {p.tags.map((t) => t.value).join(" · ")}
          </div>
          <button style={{ marginTop: 8, width: "100%" }} onClick={() => onSimilar(p)}>
            비슷한 상품 보기
          </button>
        </div>
      ))}
    </section>
  );
}
