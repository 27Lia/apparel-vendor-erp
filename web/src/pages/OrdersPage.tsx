import { useEffect, useState } from "react";
import {
  Table,
  Button,
  Modal,
  Form,
  Select,
  InputNumber,
  DatePicker,
  Input,
  Tag,
  Progress,
  Space,
  Checkbox,
  Image,
  Typography,
  message,
} from "antd";
import { PlusOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import type { Buyer, OrderDetail, OrderListItem, Product } from "../types";

const { Text } = Typography;

const STATUS_COLOR: Record<string, string> = {
  placed: "default",
  in_production: "processing",
  shipped: "blue",
  completed: "success",
  cancelled: "error",
};
const STATUS_LABEL: Record<string, string> = {
  placed: "오더접수",
  in_production: "생산중",
  shipped: "선적완료",
  completed: "완료",
  cancelled: "취소",
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [styles, setStyles] = useState<Product[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [detailCache, setDetailCache] = useState<Record<number, OrderDetail>>({});

  async function loadOrders() {
    setLoading(true);
    try {
      const res = await fetch("/api/orders");
      setOrders(await res.json());
    } finally {
      setLoading(false);
    }
  }
  async function loadBuyers() {
    const res = await fetch("/api/buyers");
    setBuyers(await res.json());
  }
  async function loadStyles() {
    const res = await fetch("/api/products");
    setStyles(await res.json());
  }

  useEffect(() => {
    loadOrders();
    loadBuyers();
    loadStyles();
  }, []);

  async function createOrder(values: {
    order_no: string;
    buyer_id: number;
    style_id: number;
    quantity: number;
    due_date?: dayjs.Dayjs;
  }) {
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        order_no: values.order_no,
        buyer_id: values.buyer_id,
        style_id: values.style_id,
        quantity: values.quantity,
        due_date: values.due_date ? values.due_date.format("YYYY-MM-DD") : null,
      }),
    });
    if (res.ok) {
      message.success("오더가 등록되었습니다.");
      form.resetFields();
      setModalOpen(false);
      await loadOrders();
    } else {
      message.error((await res.json()).error ?? "오더 생성 실패");
    }
  }

  async function loadDetail(id: number) {
    const res = await fetch(`/api/orders/${id}`);
    const data = await res.json();
    setDetailCache((prev) => ({ ...prev, [id]: data }));
  }

  async function refreshAfterChange(id: number) {
    await loadDetail(id);
    await loadOrders();
  }

  const columns = [
    { title: "오더번호", dataIndex: "order_no", key: "order_no" },
    { title: "바이어", dataIndex: "buyer_name", key: "buyer_name" },
    {
      title: "스타일",
      key: "style",
      width: 200,
      render: (_: unknown, o: OrderListItem) => (
        <Space>
          <Image src={`/uploads/${o.style_image}`} width={32} height={32} style={{ objectFit: "cover", borderRadius: 4, flexShrink: 0 }} preview={false} />
          <Text ellipsis={{ tooltip: o.style_name }} style={{ maxWidth: 140 }}>
            {o.style_name}
          </Text>
        </Space>
      ),
    },
    {
      title: "수량",
      dataIndex: "quantity",
      key: "quantity",
      render: (v: number) => v.toLocaleString(),
    },
    {
      title: "생산진행률",
      key: "progress",
      render: (_: unknown, o: OrderListItem) => (
        <div style={{ width: 140 }}>
          <Progress percent={Math.round((o.produced_qty / o.quantity) * 100)} size="small" />
          <Text type="secondary" style={{ fontSize: 11 }}>{o.produced_qty}/{o.quantity}</Text>
        </div>
      ),
    },
    {
      title: "선적상태",
      dataIndex: "shipment_status",
      key: "shipment_status",
      render: (v: string | null) => v ?? <Text type="secondary">-</Text>,
    },
    {
      title: "결제",
      dataIndex: "invoice_paid",
      key: "invoice_paid",
      render: (v: number | null) =>
        v === null ? <Text type="secondary">-</Text> : v ? <Tag color="green">완납</Tag> : <Tag color="orange">미결</Tag>,
    },
    {
      title: "상태",
      dataIndex: "status",
      key: "status",
      render: (v: string) => <Tag color={STATUS_COLOR[v]}>{STATUS_LABEL[v] ?? v}</Tag>,
    },
  ];

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
          새 오더
        </Button>
      </Space>

      <Table
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={orders}
        expandable={{
          onExpand: (expanded, record) => {
            if (expanded && !detailCache[record.id]) loadDetail(record.id);
          },
          expandedRowRender: (record) => {
            const detail = detailCache[record.id];
            if (!detail) return <Text type="secondary">불러오는 중...</Text>;
            return <OrderDetailPanel detail={detail} onChange={() => refreshAfterChange(record.id)} />;
          },
        }}
        pagination={{ pageSize: 10 }}
      />

      <Modal
        title="새 오더 등록"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={createOrder}>
          <Form.Item name="order_no" label="오더번호" rules={[{ required: true }]}>
            <Input placeholder="ON-2026-001" />
          </Form.Item>
          <Form.Item name="buyer_id" label="바이어" rules={[{ required: true }]}>
            <Select
              placeholder="바이어 선택"
              options={buyers.map((b) => ({ value: b.id, label: b.name }))}
            />
          </Form.Item>
          <Form.Item name="style_id" label="스타일" rules={[{ required: true }]}>
            <Select
              placeholder="스타일 선택 (이름 또는 브랜드로 검색)"
              showSearch
              optionFilterProp="label"
              options={styles.map((s) => ({
                value: s.id,
                label: `${s.name} (${s.brand})`,
                image: s.image_path,
              }))}
              optionRender={(option) => (
                <Space>
                  <Image
                    src={`/uploads/${option.data.image}`}
                    width={28}
                    height={28}
                    style={{ objectFit: "cover", borderRadius: 4 }}
                    preview={false}
                  />
                  {option.label}
                </Space>
              )}
            />
          </Form.Item>
          <Form.Item name="quantity" label="수량" rules={[{ required: true }]}>
            <InputNumber style={{ width: "100%" }} min={1} />
          </Form.Item>
          <Form.Item name="due_date" label="납기일">
            <DatePicker style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              등록
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

function OrderDetailPanel({ detail, onChange }: { detail: OrderDetail; onChange: () => void }) {
  const [prodForm] = Form.useForm();
  const [shipForm] = Form.useForm();
  const [invForm] = Form.useForm();

  async function addProduction(values: { factory: string; stage: string; quantity_completed: number }) {
    await fetch(`/api/orders/${detail.id}/production`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    prodForm.resetFields();
    onChange();
  }

  async function addShipment(values: {
    carrier?: string;
    port?: string;
    etd?: dayjs.Dayjs;
    eta?: dayjs.Dayjs;
    quantity: number;
  }) {
    await fetch(`/api/orders/${detail.id}/shipment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...values,
        etd: values.etd ? values.etd.format("YYYY-MM-DD") : null,
        eta: values.eta ? values.eta.format("YYYY-MM-DD") : null,
      }),
    });
    shipForm.resetFields();
    onChange();
  }

  async function addInvoice(values: { amount: number; due_date?: dayjs.Dayjs }) {
    await fetch(`/api/orders/${detail.id}/invoice`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: values.amount,
        due_date: values.due_date ? values.due_date.format("YYYY-MM-DD") : null,
      }),
    });
    invForm.resetFields();
    onChange();
  }

  async function togglePaid(invoiceId: number, paid: boolean) {
    await fetch(`/api/orders/${detail.id}/invoice/${invoiceId}/paid`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paid }),
    });
    onChange();
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24, padding: "8px 0" }}>
      <div>
        <Text strong style={{ fontSize: 13 }}>생산 (공정별 진행)</Text>
        <div style={{ margin: "8px 0" }}>
          {detail.production.map((p) => (
            <div key={p.id} style={rowStyle}>{p.log_date} · {p.factory} · {stageLabel(p.stage)} · {p.quantity_completed}개</div>
          ))}
          {detail.production.length === 0 && <Text type="secondary" style={{ fontSize: 12 }}>기록 없음</Text>}
        </div>
        <Form form={prodForm} layout="vertical" size="small" onFinish={addProduction}>
          <Form.Item name="factory" rules={[{ required: true }]} style={{ marginBottom: 8 }}>
            <Input placeholder="공장명" />
          </Form.Item>
          <Form.Item name="stage" initialValue="cutting" style={{ marginBottom: 8 }}>
            <Select
              options={[
                { value: "cutting", label: "재단" },
                { value: "sewing", label: "봉제" },
                { value: "finishing", label: "마무리" },
              ]}
            />
          </Form.Item>
          <Form.Item name="quantity_completed" rules={[{ required: true }]} style={{ marginBottom: 8 }}>
            <InputNumber style={{ width: "100%" }} placeholder="완료 수량" min={1} />
          </Form.Item>
          <Button size="small" htmlType="submit">진행 기록 추가</Button>
        </Form>
      </div>

      <div>
        <Text strong style={{ fontSize: 13 }}>선적</Text>
        <div style={{ margin: "8px 0" }}>
          {detail.shipments.map((s) => (
            <div key={s.id} style={rowStyle}>{s.carrier} · {s.port} · {s.quantity}개 · {s.status}</div>
          ))}
          {detail.shipments.length === 0 && <Text type="secondary" style={{ fontSize: 12 }}>기록 없음</Text>}
        </div>
        <Form form={shipForm} layout="vertical" size="small" onFinish={addShipment}>
          <Form.Item name="carrier" style={{ marginBottom: 8 }}>
            <Input placeholder="선사/항공사" />
          </Form.Item>
          <Form.Item name="port" style={{ marginBottom: 8 }}>
            <Input placeholder="항구" />
          </Form.Item>
          <Form.Item name="etd" style={{ marginBottom: 8 }}>
            <DatePicker style={{ width: "100%" }} placeholder="ETD" />
          </Form.Item>
          <Form.Item name="eta" style={{ marginBottom: 8 }}>
            <DatePicker style={{ width: "100%" }} placeholder="ETA" />
          </Form.Item>
          <Form.Item name="quantity" rules={[{ required: true }]} style={{ marginBottom: 8 }}>
            <InputNumber style={{ width: "100%" }} placeholder="수량" min={1} />
          </Form.Item>
          <Button size="small" htmlType="submit">선적 등록</Button>
        </Form>
      </div>

      <div>
        <Text strong style={{ fontSize: 13 }}>회계 (인보이스)</Text>
        <div style={{ margin: "8px 0" }}>
          {detail.invoices.map((i) => (
            <div key={i.id} style={rowStyle}>
              {i.currency} {i.amount.toLocaleString()} · {i.due_date ?? "-"}{" "}
              <Checkbox checked={!!i.paid} onChange={(e) => togglePaid(i.id, e.target.checked)}>결제완료</Checkbox>
            </div>
          ))}
          {detail.invoices.length === 0 && <Text type="secondary" style={{ fontSize: 12 }}>기록 없음</Text>}
        </div>
        <Form form={invForm} layout="vertical" size="small" onFinish={addInvoice}>
          <Form.Item name="amount" rules={[{ required: true }]} style={{ marginBottom: 8 }}>
            <InputNumber style={{ width: "100%" }} placeholder="금액(USD)" min={0} />
          </Form.Item>
          <Form.Item name="due_date" style={{ marginBottom: 8 }}>
            <DatePicker style={{ width: "100%" }} placeholder="만기일" />
          </Form.Item>
          <Button size="small" htmlType="submit">인보이스 발행</Button>
        </Form>
      </div>
    </div>
  );
}

function stageLabel(stage: string) {
  return { cutting: "재단", sewing: "봉제", finishing: "마무리" }[stage] ?? stage;
}

const rowStyle: React.CSSProperties = { fontSize: 12, padding: "4px 0", borderBottom: "1px solid #f0f0f0" };
