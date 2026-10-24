import Board from "../../board";
export default async function ProjectPage({params}:{params:Promise<{id:string}>}) {
  const {id}=await params;
  return <Board copyrightYear={new Date().getFullYear()} projectId={id}/>;
}
