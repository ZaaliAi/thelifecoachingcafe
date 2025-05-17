
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Check, Crown, Users, Link as LinkIcon } from "lucide-react";
import Link from "next/link";

const freeFeatures = [
  "Basic Profile (Name, Bio, Specialties, Keywords)",
  "List in Coach Directory",
  "Receive Messages from Users",
  "Submit Blog Posts (Admin Approval)",
];

const premiumFeatures = [
  "All Free Tier Features",
  "Premium Badge on Profile & Cards",
  "Link to Personal Website",
  "Embed Intro Video URL",
  "Display Social Media Links",
  "Priority Support (Coming Soon)",
  "Enhanced Profile Analytics (Coming Soon)",
];

export default function PricingPage() {
  return (
    <div className="space-y-12">
      <section className="text-center py-8">
        <Crown className="mx-auto h-12 w-12 text-primary mb-4" />
        <h1 className="text-4xl md:text-5xl font-bold mb-4">Coach Subscription Plans</h1>
        <p className="text-lg text-muted-foreground max-w-xl mx-auto">
          Choose the plan that best fits your coaching practice and reach more clients.
        </p>
      </section>

      <section className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
        {/* Free Tier Card */}
        <Card className="flex flex-col shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl flex items-center">
              <Users className="mr-3 h-7 w-7 text-muted-foreground" />
              Free Tier
            </CardTitle>
            <CardDescription>Get started and build your presence on CoachConnect.</CardDescription>
          </CardHeader>
          <CardContent className="flex-grow space-y-4">
            <p className="text-3xl font-bold">$0 <span className="text-sm font-normal text-muted-foreground">/ month</span></p>
            <ul className="space-y-2">
              {freeFeatures.map((feature, index) => (
                <li key={index} className="flex items-center">
                  <Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0" />
                  <span className="text-muted-foreground">{feature}</span>
                </li>
              ))}
            </ul>
          </CardContent>
          <CardFooter>
            <Button asChild size="lg" className="w-full" variant="outline">
              <Link href="/register-coach">Get Started for Free</Link>
            </Button>
          </CardFooter>
        </Card>

        {/* Premium Tier Card */}
        <Card className="flex flex-col shadow-xl border-2 border-primary relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-primary text-primary-foreground px-3 py-1 text-sm font-semibold rounded-bl-md">
                Most Popular
            </div>
          <CardHeader>
            <CardTitle className="text-2xl flex items-center">
              <Crown className="mr-3 h-7 w-7 text-yellow-500" />
              Premium Tier
            </CardTitle>
            <CardDescription>Unlock all features to maximize your visibility and client engagement.</CardDescription>
          </CardHeader>
          <CardContent className="flex-grow space-y-4">
            <p className="text-3xl font-bold">$19 <span className="text-sm font-normal text-muted-foreground">/ month (billed annually)</span></p>
            <ul className="space-y-2">
              {premiumFeatures.map((feature, index) => (
                <li key={index} className="flex items-center">
                  <Check className="h-5 w-5 text-primary mr-2 flex-shrink-0" />
                  <span className="text-foreground">{feature}</span>
                </li>
              ))}
            </ul>
          </CardContent>
          <CardFooter>
            <Button asChild size="lg" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
              {/* In a real app, this would go to a payment/checkout page */}
              <Link href="/register-coach?tier=premium">Upgrade to Premium</Link>
            </Button>
          </CardFooter>
        </Card>
      </section>

      <section className="text-center py-8 max-w-2xl mx-auto">
        <h3 className="text-xl font-semibold mb-3">Need Help Choosing?</h3>
        <p className="text-muted-foreground mb-4">
          If you're unsure which plan is right for you, start with the Free tier. You can always upgrade later from your coach dashboard.
        </p>
        <Button variant="link">Contact Support</Button>
      </section>
    </div>
  );
}
