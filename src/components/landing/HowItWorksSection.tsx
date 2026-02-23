export default function HowItWorksSection() {
  const steps = [
    {
      number: '1',
      title: 'Upload Documents',
      description: 'Drop your PDF, TXT, or Markdown files into your workspace collection.',
    },
    {
      number: '2',
      title: 'Auto-Index Content',
      description: 'Our system chunks your documents and generates vector embeddings automatically.',
    },
    {
      number: '3',
      title: 'Chat with AI',
      description: 'Ask questions and get accurate answers with citations from your documents.',
    },
  ]

  return (
    <section className="py-16 md:py-24 bg-neutral-50" aria-labelledby="how-it-works-heading">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2
            id="how-it-works-heading"
            className="text-2xl font-bold text-neutral-900 md:text-3xl"
          >
            How It Works
          </h2>
          <p className="mt-4 text-lg text-neutral-600">
            Get started in minutes with our simple three-step process.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-3 md:gap-6">
          {steps.map((step, index) => (
            <div key={step.number} className="relative">
              {/* Step card */}
              <article className="rounded-lg bg-white p-6 shadow-sm border border-neutral-200">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-600 text-white text-lg font-bold">
                      {step.number}
                    </span>
                  </div>
                  <div className="ml-4">
                    <h3 className="text-lg font-semibold text-neutral-900">{step.title}</h3>
                    <p className="mt-2 text-sm text-neutral-600">{step.description}</p>
                  </div>
                </div>
              </article>

              {/* Flow arrow (desktop only) */}
              {index < steps.length - 1 && (
                <div
                  className="hidden md:block absolute top-1/2 -right-3 -translate-y-1/2 z-10"
                  aria-hidden="true"
                >
                  <svg
                    className="h-6 w-6 text-indigo-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 7l5 5m0 0l-5 5m5-5H6"
                    />
                  </svg>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
