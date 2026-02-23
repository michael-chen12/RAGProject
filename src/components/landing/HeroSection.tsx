import RegistrationFormEmbed from './RegistrationFormEmbed'

export default function HeroSection() {
  return (
    <section
      className="bg-gradient-to-br from-indigo-50 to-white py-20 md:py-32"
      aria-labelledby="hero-heading"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-2 lg:gap-12 items-center">
          {/* Hero content */}
          <div>
            <h1
              id="hero-heading"
              className="text-4xl font-bold tracking-tight text-neutral-900 md:text-5xl"
            >
              Your AI-Powered Knowledge Base
            </h1>
            <p className="mt-6 text-lg text-neutral-600 md:text-xl">
              Turn your documents into an intelligent knowledge base with RAG-powered chat.
              Upload your files, get instant answers with citations, and evaluate quality—all in
              one platform.
            </p>
            <ul className="mt-8 space-y-3 text-base text-neutral-600">
              <li className="flex items-start">
                <svg
                  className="h-6 w-6 flex-shrink-0 text-indigo-600 mr-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                <span>Multi-tenant workspaces with role-based access control</span>
              </li>
              <li className="flex items-start">
                <svg
                  className="h-6 w-6 flex-shrink-0 text-indigo-600 mr-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                <span>Automated document chunking and vector embeddings</span>
              </li>
              <li className="flex items-start">
                <svg
                  className="h-6 w-6 flex-shrink-0 text-indigo-600 mr-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                <span>Citation-backed responses with source tracking</span>
              </li>
            </ul>
          </div>

          {/* Registration form */}
          <div>
            <RegistrationFormEmbed />
          </div>
        </div>
      </div>
    </section>
  )
}
