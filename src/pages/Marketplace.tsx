import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Filter, ShoppingCart, TrendingUp, Clock, Users, Zap, Award, ExternalLink } from "lucide-react";
import { useState } from "react";

const Marketplace = () => {
  const [activeTab, setActiveTab] = useState('trending');

  const nftListings = [
    {
      id: 1,
      title: "Premium Access Pass - Q1 2024",
      seller: "0x1234...5678",
      currentPrice: "0.15 ETH",
      timeLeft: "2d 14h",
      tier: "Premium",
      originalPrice: "0.05 ETH",
      profit: "+200%",
      views: "2.4K",
      thumbnail: "bg-gradient-to-br from-blue-500 to-purple-600",
      trending: true
    },
    {
      id: 2,
      title: "VIP Lifetime Membership",
      seller: "0x9876...4321",
      currentPrice: "0.8 ETH",
      timeLeft: "5d 8h",
      tier: "VIP",
      originalPrice: "0.1 ETH",
      profit: "+700%",
      views: "8.1K",
      thumbnail: "bg-gradient-to-br from-yellow-500 to-orange-600",
      trending: true
    },
    {
      id: 3,
      title: "Educational Series Bundle",
      seller: "0x5555...9999",
      currentPrice: "0.03 ETH",
      timeLeft: "1d 6h",
      tier: "Basic",
      originalPrice: "0.025 ETH",
      profit: "+20%",
      views: "892",
      thumbnail: "bg-gradient-to-br from-green-500 to-teal-600",
      trending: false
    },
    {
      id: 4,
      title: "Creator Collaboration Pass",
      seller: "0x7777...1111",
      currentPrice: "0.25 ETH",
      timeLeft: "3d 18h",
      tier: "VIP",
      originalPrice: "0.1 ETH",
      profit: "+150%",
      views: "3.7K",
      thumbnail: "bg-gradient-to-br from-purple-500 to-pink-600",
      trending: true
    }
  ];

  const marketStats = [
    { label: "Total Volume", value: "1,234 ETH", change: "+23.5%" },
    { label: "Floor Price", value: "0.025 ETH", change: "+12.3%" },
    { label: "Active Listings", value: "2,847", change: "+5.7%" },
    { label: "Unique Holders", value: "18,429", change: "+18.2%" }
  ];

  const recentSales = [
    { title: "Premium Pass #1247", price: "0.12 ETH", time: "2 minutes ago", buyer: "0x1234...5678" },
    { title: "VIP Membership #892", price: "0.75 ETH", time: "15 minutes ago", buyer: "0x9876...4321" },
    { title: "Basic Access #3456", price: "0.028 ETH", time: "1 hour ago", buyer: "0x5555...7777" },
    { title: "Creator Pass #156", price: "0.3 ETH", time: "3 hours ago", buyer: "0x8888...2222" }
  ];

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'Basic': return 'bg-muted text-muted-foreground';
      case 'Premium': return 'bg-primary/20 text-primary';
      case 'VIP': return 'bg-premium/20 text-premium';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="pt-24 pb-12 px-4 bg-gradient-to-b from-muted/20 to-background">
        <div className="container mx-auto">
          <div className="max-w-4xl mx-auto text-center mb-8">
            <Badge variant="secondary" className="mb-4">
              <ShoppingCart className="h-3 w-3 mr-1" />
              NFT Marketplace
            </Badge>
            <h1 className="text-4xl md:text-6xl font-bold mb-4">
              Trade Your
              <span className="bg-gradient-to-r from-primary to-premium bg-clip-text text-transparent ml-3">
                Access NFTs
              </span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Buy, sell, and trade subscription NFTs with other users. Turn your streaming access into liquid assets.
            </p>
          </div>

          {/* Market Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
            {marketStats.map((stat, index) => (
              <Card key={index} className="text-center neural-transition hover-lift">
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-primary">{stat.value}</div>
                  <div className="text-sm text-muted-foreground">{stat.label}</div>
                  <Badge variant="secondary" className="mt-2 text-xs">
                    <TrendingUp className="h-3 w-3 mr-1" />
                    {stat.change}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-12 px-4">
        <div className="container mx-auto">
          {/* Search and Filters */}
          <div className="flex flex-col lg:flex-row gap-4 mb-8">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search NFTs by title, creator, or ID..."
                className="pl-10 h-12 text-base"
              />
            </div>
            
            <div className="flex items-center gap-3">
              <Select>
                <SelectTrigger className="w-[180px] h-12">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Price Range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Prices</SelectItem>
                  <SelectItem value="low">Under 0.1 ETH</SelectItem>
                  <SelectItem value="mid">0.1 - 0.5 ETH</SelectItem>
                  <SelectItem value="high">Above 0.5 ETH</SelectItem>
                </SelectContent>
              </Select>

              <Select>
                <SelectTrigger className="w-[150px] h-12">
                  <SelectValue placeholder="Tier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tiers</SelectItem>
                  <SelectItem value="basic">Basic</SelectItem>
                  <SelectItem value="premium">Premium</SelectItem>
                  <SelectItem value="vip">VIP</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid lg:grid-cols-4 gap-8">
            {/* Main Listings */}
            <div className="lg:col-span-3">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="trending">
                    <TrendingUp className="h-4 w-4 mr-2" />
                    Trending
                  </TabsTrigger>
                  <TabsTrigger value="newest">
                    <Clock className="h-4 w-4 mr-2" />
                    Newest
                  </TabsTrigger>
                  <TabsTrigger value="ending">
                    <Zap className="h-4 w-4 mr-2" />
                    Ending Soon
                  </TabsTrigger>
                </TabsList>

                <TabsContent value={activeTab} className="mt-6">
                  <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {nftListings.map((listing) => (
                      <Card 
                        key={listing.id}
                        className="group neural-transition hover-lift border-border hover:border-primary/50 overflow-hidden"
                      >
                        <CardContent className="p-0">
                          {/* NFT Preview */}
                          <div className="relative aspect-square">
                            <div className={`w-full h-full ${listing.thumbnail} flex items-center justify-center relative`}>
                              <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 neural-transition"></div>
                              
                              {/* Tier Badge */}
                              <div className="absolute top-3 left-3">
                                <Badge className={`${getTierColor(listing.tier)} text-xs`}>
                                  {listing.tier}
                                </Badge>
                              </div>

                              {/* Trending Badge */}
                              {listing.trending && (
                                <div className="absolute top-3 right-3">
                                  <Badge variant="secondary" className="bg-secondary/20 text-secondary border-none">
                                    <TrendingUp className="h-3 w-3 mr-1" />
                                    Hot
                                  </Badge>
                                </div>
                              )}

                              {/* Time Left */}
                              <div className="absolute bottom-3 left-3">
                                <Badge variant="secondary" className="bg-black/50 text-white border-none">
                                  <Clock className="h-3 w-3 mr-1" />
                                  {listing.timeLeft}
                                </Badge>
                              </div>

                              {/* Views */}
                              <div className="absolute bottom-3 right-3">
                                <Badge variant="secondary" className="bg-black/50 text-white border-none">
                                  <Users className="h-3 w-3 mr-1" />
                                  {listing.views}
                                </Badge>
                              </div>

                              {/* Center Content */}
                              <div className="relative z-10 text-center text-white">
                                <div className="text-2xl font-bold mb-2">{listing.currentPrice}</div>
                                <div className="text-sm opacity-80">Current Bid</div>
                              </div>
                            </div>
                          </div>

                          {/* Listing Info */}
                          <div className="p-6">
                            <h4 className="font-semibold text-lg mb-2 group-hover:text-primary neural-transition">
                              {listing.title}
                            </h4>
                            
                            <div className="flex items-center justify-between text-sm text-muted-foreground mb-4">
                              <span>Seller: {listing.seller}</span>
                              <Badge variant="secondary" className="text-success">
                                {listing.profit}
                              </Badge>
                            </div>

                            <div className="flex items-center justify-between">
                              <div>
                                <div className="text-xs text-muted-foreground">Original Price</div>
                                <div className="font-medium">{listing.originalPrice}</div>
                              </div>

                              <Button variant="hero" size="sm">
                                <ShoppingCart className="h-4 w-4 mr-2" />
                                Buy Now
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </TabsContent>
              </Tabs>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Recent Sales */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Recent Sales</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {recentSales.map((sale, index) => (
                    <div key={index} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 neural-transition">
                      <div className="flex-1">
                        <div className="font-medium text-sm">{sale.title}</div>
                        <div className="text-xs text-muted-foreground">{sale.time}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-primary text-sm">{sale.price}</div>
                        <div className="text-xs text-muted-foreground">{sale.buyer}</div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Quick Actions */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button variant="hero" className="w-full">
                    <Award className="h-4 w-4 mr-2" />
                    List Your NFT
                  </Button>
                  <Button variant="outline" className="w-full">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Portfolio Tracker
                  </Button>
                  <Button variant="outline" className="w-full">
                    <TrendingUp className="h-4 w-4 mr-2" />
                    Market Analytics
                  </Button>
                </CardContent>
              </Card>

              {/* Price Guide */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Price Guide</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm">Basic Tier</span>
                    <span className="font-medium">0.02-0.05 ETH</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Premium Tier</span>
                    <span className="font-medium">0.05-0.2 ETH</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">VIP Tier</span>
                    <span className="font-medium">0.1-1.0 ETH</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Marketplace;