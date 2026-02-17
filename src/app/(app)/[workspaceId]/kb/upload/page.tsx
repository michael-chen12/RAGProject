import { UploadDropzone } from '@/components/kb/upload-dropzone'

type PageProps = { params: Promise<{ workspaceId: string }> }

export const metadata = { title: 'Upload Documents' }

export default async function UploadPage({ params }: PageProps) {
  const { workspaceId } = await params

  return (
    <div className="max-w-xl mx-auto py-10 px-4">
      <h1 className="text-xl font-semibold mb-1">Upload Documents</h1>
      <p className="text-sm text-gray-500 mb-6">
        Upload a PDF or plain-text file. It will be chunked and indexed into the
        knowledge base automatically.
      </p>
      <UploadDropzone workspaceId={workspaceId} />
    </div>
  )
}
