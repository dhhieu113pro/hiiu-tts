const AVAILABLE_VOICES = [
  "Ngọc Huyền (mới)", "Ban Mai", "Chiếu Thành", "Duy Oryx", "Lạc Phi", "Mai Phương", 
  "Mạnh Dũng", "Minh Khang", "Minh Quang", "Minh Thu", "Mỹ Tâm", "Ngọc Huyền", 
  "Ngọc Ngạn", "Phương Trang", "Tài An", "Thanh Phương", "Thanh Phương Viettel", 
  "Thiện Tâm", "Trấn Thành", "Việt Thảo"
];

export default (request: Request): Response => {
  if (request.method !== "GET") {
    return Response.json({ error: { message: "Method not allowed", type: "invalid_request_error" } }, { status: 405 });
  }
  return Response.json({
    object: "list",
    data: AVAILABLE_VOICES.map(name => ({
      id: name,
      object: "model",
      owned_by: "nghitts",
      aliases: name === "Ngọc Huyền (mới)" ? ["default"] : []
    }))
  });
};
