import { useState } from "react";
import { Layout, Menu, Typography } from "antd";
import {
  FileTextOutlined,
  TeamOutlined,
  SkinOutlined,
} from "@ant-design/icons";
import OrdersPage from "./pages/OrdersPage";
import EmployeesPage from "./pages/EmployeesPage";
import ProductsPage from "./pages/ProductsPage";

const { Header, Sider, Content } = Layout;
const { Title, Text } = Typography;

const TABS = [
  { key: "orders", label: "오더 현황", icon: <FileTextOutlined /> },
  { key: "employees", label: "인사", icon: <TeamOutlined /> },
  { key: "products", label: "스타일(상품)", icon: <SkinOutlined /> },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default function App() {
  const [tab, setTab] = useState<TabKey>("orders");

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider width={220} theme="light" style={{ borderRight: "1px solid #f0f0f0" }}>
        <div style={{ padding: "20px 20px 12px" }}>
          <Title level={4} style={{ margin: 0 }}>YAKJIN ERP</Title>
          <Text type="secondary" style={{ fontSize: 12 }}>오더 · 생산 · 선적 · 회계 · 인사</Text>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[tab]}
          items={TABS.map((t) => ({ key: t.key, icon: t.icon, label: t.label }))}
          onClick={(e) => setTab(e.key as TabKey)}
          style={{ borderInlineEnd: "none" }}
        />
      </Sider>
      <Layout>
        <Header style={{ background: "#fff", borderBottom: "1px solid #f0f0f0", display: "flex", alignItems: "center", paddingInline: 24 }}>
          <Text strong style={{ fontSize: 16 }}>
            {TABS.find((t) => t.key === tab)?.label}
          </Text>
        </Header>
        <Content style={{ margin: 24 }}>
          {tab === "orders" && <OrdersPage />}
          {tab === "employees" && <EmployeesPage />}
          {tab === "products" && <ProductsPage />}
        </Content>
      </Layout>
    </Layout>
  );
}
