
import { Button } from '@/components/ui/button';
import { UserCheck, Clapperboard, Link as LinkIcon, Share2, Crown } from 'lucide-react';
import NextLink from 'next/link';

const features = [
  {
    name: 'Profile Image',
    icon: UserCheck,
  },
  {
    name: 'Social Media Link',
    icon: Share2,
  },
  {
    name: 'Website Link',
    icon: LinkIcon,
  },
  {
    name: 'Intro Video',
    icon: Clapperboard,
  },
]

const PremiumHighlight = () => {
  return (
    <div className="bg-gray-900 py-8 border border-yellow-400 rounded-lg">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        {/* Top section with Title and CTA */}
        <div className="md:flex md:items-start md:justify-between">
          <div className="max-w-xl flex-shrink-0">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl flex items-center">
              <Crown className="h-8 w-8 mr-3 text-yellow-400 flex-shrink-0" />
              <span>Stand Out with <span className="text-yellow-400">Premium</span></span>
            </h2>
            <p className="mt-4 text-base leading-7 text-gray-300">
              Premium accounts unlock exclusive features and connect with more clients.
            </p>
          </div>
          <div className="mt-6 md:mt-0 md:ml-6 flex-shrink-0">
            <Button asChild size="lg" className="bg-yellow-400 text-gray-900 hover:bg-yellow-300 focus-visible:outline-yellow-500">
                <NextLink href="/pricing">Get Premium Now</NextLink>
            </Button>
          </div>
        </div>

        {/* Features section */}
        <div className="mt-12">
          <dl className="grid grid-cols-2 gap-x-8 gap-y-10 lg:grid-cols-4">
            {features.map((feature) => (
              <div key={feature.name} className="flex flex-col items-center text-center">
                <dt className="flex items-center gap-x-3 text-base font-semibold leading-7 text-white">
                  <feature.icon className="h-6 w-6 flex-none text-yellow-400" aria-hidden="true" />
                </dt>
                <dd className="mt-2 text-sm leading-6 text-gray-300">
                  <p className="flex-auto">{feature.name}</p>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>
  );
};

export default PremiumHighlight;
