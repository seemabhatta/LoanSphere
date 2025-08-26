import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Database, 
  Bot, 
  Zap, 
  TrendingUp, 
  FileText, 
  Shield, 
  BarChart3,
  CheckCircle,
  ArrowRight,
  Menu
} from "lucide-react";

export default function Landing() {
  const handleSignIn = () => {
    window.location.href = "/api/login";
  };

  const handleRequestDemo = () => {
    window.location.href = "/api/login";
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center">
              <div className="flex-shrink-0 flex items-center">
                <Bot className="h-10 w-10 text-blue-600 mr-3" />
                <h1 className="text-2xl font-bold text-gray-900">Xpanse Loan Xchange</h1>
              </div>
            </div>
            <div className="hidden md:block">
              <Button 
                onClick={handleRequestDemo}
                className="bg-blue-600 hover:bg-blue-700 px-6 py-2.5 rounded-lg font-medium"
                data-testid="button-request-demo"
              >
                Request a Demo
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
            <div className="md:hidden">
              <Menu className="h-6 w-6 text-gray-600" />
            </div>
          </div>
        </div>
      </header>

      {/* Three Pillars Icons */}
      <section className="py-8 border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-center items-center space-x-16">
            <div className="flex items-center space-x-2 text-gray-600">
              <Database className="h-6 w-6" />
              <span className="font-medium">data</span>
            </div>
            <div className="flex items-center space-x-2 text-gray-600">
              <Zap className="h-6 w-6" />
              <span className="font-medium">automation</span>
            </div>
            <div className="flex items-center space-x-2 text-gray-600">
              <Bot className="h-6 w-6" />
              <span className="font-medium">ai</span>
            </div>
          </div>
        </div>
      </section>

      {/* Hero Section */}
      <section className="py-20 lg:py-32 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center">
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-gray-900 mb-8 leading-tight">
              Unmatched Velocity,<br />
              <span className="text-gray-900">Precise Reliability</span>
            </h1>
            <p className="text-xl lg:text-2xl text-gray-600 mb-12 max-w-4xl mx-auto leading-relaxed">
              Harness the power of data and AI to drive automation for your mortgage business. 
              Expedite your turnaround times and elevate your accuracy with intuitive, dynamic tools 
              that will level up your business.
            </p>
            <Button 
              onClick={handleSignIn} 
              size="lg" 
              className="bg-blue-600 hover:bg-blue-700 text-lg px-10 py-4 rounded-lg font-medium"
              data-testid="button-book-demo"
            >
              Book a Demo
            </Button>
          </div>
        </div>
      </section>

      {/* Trusted by Industry Leaders */}
      <section className="py-16 bg-gray-50 border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h3 className="text-center text-lg font-semibold text-gray-900 mb-12">
            Trusted by Industry Leaders
          </h3>
          <div className="flex flex-wrap justify-center items-center gap-8 lg:gap-16 opacity-60">
            <div className="text-2xl font-bold text-gray-400">Moder</div>
            <div className="text-2xl font-bold text-gray-400">Freedom Mortgage</div>
            <div className="text-2xl font-bold text-gray-400">MortgageConnect</div>
            <div className="text-2xl font-bold text-gray-400">Snowflake</div>
            <div className="text-2xl font-bold text-gray-400">Sigma</div>
            <div className="text-2xl font-bold text-gray-400">Podium</div>
          </div>
        </div>
      </section>

      {/* Next-Gen Solutions Section */}
      <section className="py-20 lg:py-32 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-6">
              Next-Gen Solutions,<br />
              <span className="text-gray-900">Advanced Automation</span>
            </h2>
            <p className="text-xl text-gray-600 max-w-4xl mx-auto mb-10">
              Pick and choose from this one-of-a-kind marketplace for intelligent automation, 
              where you can streamline partner interactions, seamlessly exchange data, and 
              accelerate turnaround times—no coding required!
            </p>
            <Button 
              variant="outline" 
              className="border-blue-600 text-blue-600 hover:bg-blue-50 px-6 py-3 rounded-lg font-medium"
            >
              Discover Xpanse's Features
            </Button>
          </div>

          {/* Benefits Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12 mt-20">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-6">
                <TrendingUp className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Skyrocket efficiency</h3>
              <p className="text-gray-600">
                Eliminate manual processes while boosting accuracy and turnaround times with 
                this state-of-the-art approach to data automation and AI.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-6">
                <BarChart3 className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Boost conversions</h3>
              <p className="text-gray-600">
                Watch as pull-through rates rise and the burden of legacy technology and human 
                error are minimized, freeing up the capital you need to elevate your business.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-red-100 rounded-lg flex items-center justify-center mx-auto mb-6">
                <Database className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Slash costs</h3>
              <p className="text-gray-600">
                Catapult your ROI and dodge costly mistakes as our tech forges a pathway toward 
                seamless data exchanges alongside streamlined processes and partner interactions.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Solutions Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-6">
              Clever Solutions,<br />
              <span className="text-gray-900">Top-Line Tech</span>
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Xpanse Loan Xchange grants you access to incredible tools that will revolutionize 
              your business processes.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Intelligent Document Processing */}
            <Card className="p-8 hover:shadow-lg transition-shadow bg-white">
              <CardContent className="space-y-6">
                <div className="flex items-center space-x-3">
                  <FileText className="w-8 h-8 text-blue-600" />
                  <h3 className="text-2xl font-bold text-gray-900">Intelligent Document Processing</h3>
                </div>
                <p className="text-gray-600 text-lg">
                  Accurately extracts and indexes document information and secures it within a 
                  centralized, cloud-based platform.
                </p>
                <div className="grid grid-cols-2 gap-6 py-4">
                  <div>
                    <div className="text-3xl font-bold text-blue-600">700+</div>
                    <div className="text-sm text-gray-600">Pretrained Mortgage Documents</div>
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-blue-600">1,300+</div>
                    <div className="text-sm text-gray-600">Data Elements</div>
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-blue-600">25+</div>
                    <div className="text-sm text-gray-600">Pages Per Second</div>
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-blue-600">2B+</div>
                    <div className="text-sm text-gray-600">Pages Processed</div>
                  </div>
                </div>
                <Button className="w-full bg-blue-600 hover:bg-blue-700">
                  Explore Now
                </Button>
              </CardContent>
            </Card>

            {/* Intelligent Assistant */}
            <Card className="p-8 hover:shadow-lg transition-shadow bg-white">
              <CardContent className="space-y-6">
                <div className="flex items-center space-x-3">
                  <Bot className="w-8 h-8 text-green-600" />
                  <h3 className="text-2xl font-bold text-gray-900">Intelligent Assistant</h3>
                </div>
                <p className="text-gray-600 text-lg">
                  Utilizes your structured data to create tailored knowledge modeling, 
                  boosting workflow efficiencies.
                </p>
                <div className="grid grid-cols-2 gap-6 py-4">
                  <div>
                    <div className="text-3xl font-bold text-green-600">20K+</div>
                    <div className="text-sm text-gray-600">monthly sessions completed</div>
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-green-600">700+</div>
                    <div className="text-sm text-gray-600">pretrained mortgage documents</div>
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-green-600">35+</div>
                    <div className="text-sm text-gray-600">available integrations</div>
                  </div>
                  <div></div>
                </div>
                <Button className="w-full bg-green-600 hover:bg-green-700">
                  Discover How
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 lg:py-32 bg-white">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-6">
            Ready to Level up Your Mortgage Business?
          </h2>
          <p className="text-xl text-gray-600 mb-12">
            We'll be in touch ASAP.
          </p>
          <Button 
            onClick={handleSignIn}
            size="lg" 
            className="bg-blue-600 hover:bg-blue-700 text-lg px-10 py-4 rounded-lg font-medium"
            data-testid="button-start-now"
          >
            Book a Demo
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="col-span-1 md:col-span-2">
              <div className="flex items-center mb-6">
                <Bot className="h-8 w-8 text-blue-400 mr-3" />
                <span className="text-2xl font-bold">Xpanse Loan Xchange</span>
              </div>
              <p className="text-gray-400 mb-4">info@xpanse.com</p>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Products</h4>
              <ul className="space-y-2 text-gray-400">
                <li>Loan Boarding Platform</li>
                <li>Document Processing</li>
                <li>AI Assistant</li>
                <li>Exception Management</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-gray-400">
                <li>About</li>
                <li>Careers</li>
                <li>Resources</li>
                <li>Contact</li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-gray-800 pt-8 mt-12 flex flex-col md:flex-row justify-between items-center">
            <div className="text-gray-400 text-sm">
              © 2024 Xpanse Loan Xchange. All rights reserved.
            </div>
            <div className="flex space-x-6 text-sm text-gray-400 mt-4 md:mt-0">
              <span>Privacy Policy</span>
              <span>Accessibility</span>
              <span>Terms of Service</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}