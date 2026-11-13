import PriceGuideScreen from "@/components/price/PriceGuideScreen";

// Guide 13: the price guide, reachable from the Find and Account tabs.
export default function PriceGuideRoute() {
  return <PriceGuideScreen itemPath="/(dashboard)/(find)/price-item" />;
}
