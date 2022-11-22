const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const producto=require("../models/productos");
const APIFeatures = require("../utils/apiFeatures");
const ErrorHandler = require("../utils/errorHandler");
const fetch =(url)=>import('node-fetch').then(({default:fetch})=>fetch(url)); //Usurpación del require
const cloudinary=require("cloudinary")

//ver la lista de productos
exports.getProducts=catchAsyncErrors(async (req,res,next) =>{

    const resPerPage = 4;
    const productsCount = await producto.countDocuments();

    const apiFeatures = new APIFeatures(producto.find(), req.query)
        .search()
        .filter();

    let products = await apiFeatures.query;
    let filteredProductsCount= products.length;
    apiFeatures.pagination(resPerPage);
    products = await apiFeatures.query.clone();

    res.status(200).json({
        success: true,
        productsCount,
        resPerPage,
        filteredProductsCount,
        products
    })


    /*const productos= await producto.find();
    if (!productos){
        return next(new ErrorHandler("Informacion no encontrada", 404))
    }

    res.status(200).json({
        success:true,
        cantidad: productos.length,
        productos
        //message: "En esta ruta ud podra ver todos los productos" for show a message
    })*/
})
          
//ver un prodcuto  por id
exports.getProductById= catchAsyncErrors( async (req, res, next)=>{
    const product= await producto.findById(req.params.id)
    
    if (!product){
            return next(new ErrorHandler("Producto no encontrado", 404))
        }
    
    res.status(200).json({
        success:true,
        message:"Aqui debajo encuentras información sobre tu producto: ",
        product
    })
})


//Crear nuevo producto /api/productos
exports.newProduct=catchAsyncErrors(async(req,res,next)=>{
    let imagen=[]
    if(typeof req.body.imagen==="string"){
        imagen.push(req.body.imagen)
    }else{
        imagen=req.body.imagen
    }

    let imagenLink=[]

    for (let i=0; i<imagen.length;i++){
        const result = await cloudinary.v2.uploader.upload(imagen[i],{
            folder:"products"
        })
        imagenLink.push({
            public_id:result.public_id,
            url: result.secure_url
        })
    }

    req.body.imagen=imagenLink
    req.body.user=req.user.id;
    const product= await producto.create(req.body);
    res.status(201).json({
        success:true,
        product
    })
})

//updating a product
exports.updateProduct= catchAsyncErrors(async (req,res,next) =>{
    let product= await producto.findById(req.params.id) //Variable de tipo modificable
    if (!product){ //Verifico que el objeto no existe para finalizar el proceso
        return next(new ErrorHandler("Producto no encontrado", 404))
    }
    let imagen=[]

    if (typeof req.body.imagen=="string"){
        imagen.push(req.body.imagen)
    }else{
        imagen=req.body.imagen
    }
    if (imagen!== undefined){
        //eliminar imagenes asociadas con el product
        for (let i=0; i<product.imagen.lenght; i++){
            const result= await cloudinary.v2.uploader.destroy(product.images[i].public_id)
        }

        let imageLinks=[]
        for (let i=0; i<imagen.lenght; i++){
            const result=await cloudinary.v2.uploader.upload(imagen[i],{
                folder:"products"
            });
            imageLinks.push({
                public_id:result.public_id,
                url: result.secure_url
            })
        }
        req.body.imagen=imageLinks
    }
    
    //Si el objeto si existia, entonces si ejecuto la actualización
    product= await producto.findByIdAndUpdate(req.params.id, req.body, {
        new:true, //Valido solo los atributos nuevos o actualizados
        runValidators:true
    });
    //Respondo Ok si el producto si se actualizó
    res.status(200).json({
        success:true,
        message:"Producto actualizado correctamente",
        product
    })
})

//Eliminar un producto
exports.deleteProduct= catchAsyncErrors(async (req,res,next) =>{
    const product= await producto.findById(req.params.id) //Variable de tipo modificable
    if (!product){ //check the existnce of the product
        return next(new ErrorHandler("Producto no encontrado", 404))
    }

    await product.remove();//remove in order to respect static order as opposite of delete, the tail is dinamic
    res.status(200).json({
        success:true,
        message:"Producto eliminado correctamente"
    })
})

//FETCH
//Ver todos los productos
function verProductos(){
    fetch('http://localhost:4000/api/productos')
    .then(res=>res.json())
    .then(res=>console.log(res))
    .catch(err=>console.error(err))
}

//verProductos();

//Ver por id
function verProductoPorID(id){
    fetch('http://localhost:4000/api/producto/'+id)
    .then(res=>res.json())
    .then(res=>console.log(res))
    .catch(err=>console.error(err))
}
 
//verProductoPorID('63546690aee8397ce04de0d2'); 

//Crear o actualizar una review
exports.createProductReview = catchAsyncErrors(async (req, res, next) => {
    const { rating, comentario, idProducto } = req.body;

    const opinion = {
        nombreCliente: req.user.nombre,
        rating: Number(rating),
        comentario
    }

    const product = await producto.findById(idProducto);

    const isReviewed = product.opiniones.find(item =>
        item.nombreCliente === req.user.nombre)

    if (isReviewed) {
        product.opiniones.forEach(opinion => {
            if (opinion.nombreCliente === req.user.nombre) {
                opinion.comentario = comentario,
                    opinion.rating = rating
            }
        })
    } else {
        product.opiniones.push(opinion)
        product.numCalificaciones = product.opiniones.length
    }

    product.calificacion = product.opiniones.reduce((acc, opinion) =>
        opinion.rating + acc, 0) / product.opiniones.length

    await product.save({ validateBeforeSave: false });

    res.status(200).json({
        success: true,
        message: "Hemos opinado correctamente"
    })

})

//Ver todas las review de un producto
exports.getProductReviews = catchAsyncErrors(async (req, res, next) => {
    const product = await producto.findById(req.query.id)

    res.status(200).json({
        success: true,
        opiniones: product.opiniones
    })
})

//Eliminar review
exports.deleteReview = catchAsyncErrors(async (req, res, next) => {
    const product = await producto.findById(req.query.idProducto);

    const opi = product.opiniones.filter(opinion => 
        opinion._id.toString() !== req.query.idReview.toString());

        const numCalificaciones = opi.length;

        const calificacion = opi.reduce((acc, Opinion) =>
            Opinion.rating + acc, 0) / opi.length;

        await producto.findByIdAndUpdate(req.query.idProducto, {
            opi,
            calificacion,
            numCalificaciones
        }, {
            new: true,
            runValidators: true,
            useFindAndModify: false
        })
        res.status(200).json({
            success: true,
            message: "review eliminada correctamente"
        })

    })

//Ver la lista de productos (Admin) no filters
exports.getAdminProducts = catchAsyncErrors(async (req, res, next) => {

    const products = await producto.find()

    res.status(200).json({
        products
    })

})

    //HABLEMOS DE FETCH
    //Ver todos los productos
    function verProductos() {
        fetch('http://localhost:4000/api/productos')
            .then(res => res.json())
            .then(res => console.log(res))
            .catch(err => console.error(err))
    }

    //verProductos(); LLamamos al metodo creado para probar la consulta

    //Ver por id
    function verProductoPorID(id) {
        fetch('http://localhost:4000/api/producto/' + id)
            .then(res => res.json())
            .then(res => console.log(res))
            .catch(err => console.error(err))
    }