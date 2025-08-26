import { Button } from "@/components/ui/button";
import { ArrowRight, Shield, Zap, Target, CheckCircle, Chrome } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

interface OAuthProvider {
  name: string;
  display_name: string;
  login_url: string;
}

interface ProvidersResponse {
  providers: OAuthProvider[];
}

const providerIcons = {
  google: Chrome,
};

export default function Landing() {
  const [showLoginOptions, setShowLoginOptions] = useState(false);
  
  const { data: providersData } = useQuery<ProvidersResponse>({
    queryKey: ["/api/auth/providers"],
    retry: false,
  });

  const handleSignInClick = () => {
    if (providersData?.providers && providersData.providers.length > 1) {
      setShowLoginOptions(!showLoginOptions);
    } else if (providersData?.providers && providersData.providers.length === 1) {
      window.location.href = providersData.providers[0].login_url;
    } else {
      // If no providers loaded yet, try Google directly as fallback
      window.location.href = "/api/auth/google";
    }
  };

  return (
    <div className="min-h-screen bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="pt-8 pb-8">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <img 
                src="https://www.xpanse.com/logo.svg" 
                alt="Xpanse Logo" 
                className="h-8 w-auto"
              />
              <span className="text-xl font-bold text-white">Loan Xchange</span>
            </div>
            <div className="relative">
              <Button
                onClick={handleSignInClick}
                className="bg-blue-600 hover:bg-blue-700 text-white"
                data-testid="button-login"
              >
                Sign In
              </Button>
              
              {showLoginOptions && providersData?.providers && providersData.providers.length > 1 && (
                <div className="absolute right-0 mt-2 w-48 bg-gray-800 rounded-md shadow-lg z-10 border border-gray-700">
                  <div className="py-1">
                    {providersData.providers.map((provider) => {
                      const IconComponent = providerIcons[provider.name as keyof typeof providerIcons];
                      return (
                        <button
                          key={provider.name}
                          onClick={() => window.location.href = provider.login_url}
                          className="flex items-center w-full px-4 py-2 text-sm text-white hover:bg-gray-700 transition-colors"
                        >
                          {IconComponent && <IconComponent className="w-4 h-4 mr-3" />}
                          {provider.display_name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Hero Section */}
        <div className="text-center py-20">
          <h1 className="text-5xl font-bold text-white mb-6">
            Transform Loan Boarding with
            <span className="block text-blue-400 mt-2">AI-Powered Automation</span>
          </h1>
          <p className="text-xl text-gray-300 mb-8 max-w-3xl mx-auto">
            Achieve 85% First-Pass Yield, ≤2 hour Time-to-Board, and 100% regulatory compliance 
            with our multi-agent loan boarding automation platform.
          </p>
          <Button
            onClick={handleSignInClick}
            size="lg"
            className="bg-blue-600 hover:bg-blue-700 text-lg px-8 py-3"
            data-testid="button-get-started"
          >
            Get Started
            <ArrowRight className="ml-2 w-5 h-5" />
          </Button>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 py-16">
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Target className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-3xl font-bold text-white mb-2">85%</h3>
            <p className="text-gray-300">First-Pass Yield Target</p>
          </div>
          <div className="text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Zap className="w-8 h-8 text-blue-600" />
            </div>
            <h3 className="text-3xl font-bold text-white mb-2">≤2h</h3>
            <p className="text-gray-300">Time-to-Board</p>
          </div>
          <div className="text-center">
            <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Shield className="w-8 h-8 text-purple-600" />
            </div>
            <h3 className="text-3xl font-bold text-white mb-2">100%</h3>
            <p className="text-gray-300">RESPA/TILA Compliance</p>
          </div>
        </div>

        {/* Features */}
        <div className="py-16">
          <h2 className="text-3xl font-bold text-center text-white mb-12">
            Complete Loan Boarding Automation
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="text-center">
              <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-4" />
              <h3 className="font-semibold text-white mb-2">Multi-Agent Pipeline</h3>
              <p className="text-sm text-gray-300">Specialized AI agents for document processing, validation, and compliance</p>
            </div>
            <div className="text-center">
              <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-4" />
              <h3 className="font-semibold text-white mb-2">Exception Management</h3>
              <p className="text-sm text-gray-300">70% auto-clear rate for exceptions within 5 minutes</p>
            </div>
            <div className="text-center">
              <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-4" />
              <h3 className="font-semibold text-white mb-2">Real-Time Monitoring</h3>
              <p className="text-sm text-gray-300">Live pipeline tracking and performance analytics</p>
            </div>
            <div className="text-center">
              <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-4" />
              <h3 className="font-semibold text-white mb-2">Agency Integration</h3>
              <p className="text-sm text-gray-300">Seamless integration with Fannie Mae, Freddie Mac, and Ginnie Mae</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}