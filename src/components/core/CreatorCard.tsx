import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { Creator } from "@/data/creators";
import TradeDialog from "./TradeDialog";

interface CreatorCardProps {
  creator: Creator;
}

const CreatorCard = ({ creator }: CreatorCardProps) => {
  return (
    <article className="group relative">
      <Card className="overflow-hidden transition-transform duration-300 hover:-translate-y-0.5 hover:shadow-soft">
        <CardHeader className="flex-row items-center gap-4">
          <img
            src={creator.avatar}
            alt={`${creator.name} avatar`}
            loading="lazy"
            className="size-14 rounded-full object-cover ring-2 ring-accent/20"
          />
          <div className="flex-1">
            <CardTitle className="text-lg">
              <Link to={`/creator/${creator.slug}`}>{creator.name}</Link>
            </CardTitle>
            <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="secondary">{creator.type}</Badge>
              <span className="truncate">{creator.team}</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-2">
          <div className="flex items-center justify-between text-sm">
            <div>
              <span className="text-muted-foreground">Floor</span>
              <div className="font-semibold">{creator.floorPrice.toFixed(2)} CFN</div>
            </div>
            <div className="text-right">
              <span className="text-muted-foreground">Supply</span>
              <div className="font-semibold">{creator.supply.toLocaleString()}</div>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Link to={`/creator/${creator.slug}`} className="flex-1">
              <Button variant="soft" className="w-full">View</Button>
            </Link>
            <TradeDialog creator={creator}>
              <Button variant="hero" size="default">Trade</Button>
            </TradeDialog>
          </div>
        </CardContent>
      </Card>
      <div className="pointer-events-none absolute inset-0 rounded-lg opacity-0 transition-opacity group-hover:opacity-100" />
    </article>
  );
};

export default CreatorCard;
